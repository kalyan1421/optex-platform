import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { ScanItemDto, StockCountDto, StartStockCountDto } from './dto/stock-count.dto';

interface StockCountHeaderRow {
  id: string;
  branch_id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
}

type EmbeddedProduct = { name: string } | { name: string }[] | null;
const unwrapProduct = (embed: EmbeddedProduct) => (Array.isArray(embed) ? (embed[0] ?? null) : embed);

/**
 * Physical stock counts — R2 sub-phase 2d. Starting a count and scanning
 * items are plain sequential writes (they touch only `stock_count_items`,
 * never `product_serials`/`inventory`/`stock_ledger` — same low-risk class as
 * a GRN's draft phase). Only `accept()` writes the ledger, so only it is a
 * `SECURITY DEFINER` RPC (`accept_stock_count`, migration 0029).
 */
@Injectable()
export class StockCountsService {
  private readonly logger = new Logger(StockCountsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  /** Snapshots every serial the system currently believes is in stock at this branch as an "expected" line. */
  async start(dto: StartStockCountDto, actorUser: AuthUser): Promise<StockCountDto> {
    const { data: header, error: headerError } = await this.db
      .from('stock_counts')
      .insert({ branch_id: dto.branch_id, started_by: actorUser.id })
      .select('id, branch_id, status, started_at, completed_at')
      .single();
    if (headerError) {
      this.logger.error(`Failed to start stock count: ${headerError.message}`);
      throw new InternalServerErrorException('Failed to start stock count');
    }
    const count = header as StockCountHeaderRow;

    const { data: expected, error: expectedError } = await this.db
      .from('product_serials')
      .select('id, product_id')
      .eq('status', 'in_stock')
      .eq('current_branch_id', dto.branch_id);
    if (expectedError) {
      await this.db.from('stock_counts').delete().eq('id', count.id);
      this.logger.error(`Failed to snapshot expected stock for count ${count.id}: ${expectedError.message}`);
      throw new InternalServerErrorException('Failed to start stock count');
    }

    if (expected && expected.length > 0) {
      const { error: itemsError } = await this.db.from('stock_count_items').insert(
        expected.map((row) => ({
          count_id: count.id,
          serial_id: row.id,
          product_id: row.product_id,
          expected: true,
          found: false,
        })),
      );
      if (itemsError) {
        await this.db.from('stock_counts').delete().eq('id', count.id);
        this.logger.error(`Failed to insert expected items for count ${count.id}: ${itemsError.message}`);
        throw new InternalServerErrorException('Failed to start stock count');
      }
    }

    const created = await this.findById(count.id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'stock_counts.start',
      resourceType: 'stock_counts',
      resourceId: count.id,
      metadata: { branchId: dto.branch_id, expectedCount: expected?.length ?? 0 },
    });
    return created;
  }

  private async loadInProgress(id: string): Promise<StockCountHeaderRow> {
    const { data, error } = await this.db
      .from('stock_counts')
      .select('id, branch_id, status, started_at, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch stock count ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch stock count');
    }
    if (!data) throw new NotFoundException(`Stock count ${id} not found`);
    const count = data as StockCountHeaderRow;
    if (count.status !== 'in_progress') {
      throw new ConflictException('This count has already been resolved');
    }
    return count;
  }

  /**
   * Records each scan against the count. A scan matching an existing
   * `product_serials` row (expected or not) marks/creates a `found` line for
   * it. A scan matching nothing is recorded by its literal serial number —
   * SPEC-08's own edge case, "a physical count finds stock the system does
   * not have" — and needs a `product_id` (now or on a later scan call of the
   * same serial number) before the count can be accepted.
   */
  async scan(id: string, scans: ScanItemDto[], actorUser: AuthUser): Promise<StockCountDto> {
    const count = await this.loadInProgress(id);

    for (const scan of scans) {
      const { data: matchedSerial } = await this.db
        .from('product_serials')
        .select('id, product_id')
        .eq('serial_number', scan.serial_number)
        .maybeSingle();

      if (matchedSerial) {
        const { data: existingItem } = await this.db
          .from('stock_count_items')
          .select('id, found')
          .eq('count_id', count.id)
          .eq('serial_id', matchedSerial.id)
          .maybeSingle();

        if (existingItem) {
          if (!existingItem.found) {
            await this.db.from('stock_count_items').update({ found: true }).eq('id', existingItem.id);
          }
        } else {
          await this.db.from('stock_count_items').insert({
            count_id: count.id,
            serial_id: matchedSerial.id,
            product_id: matchedSerial.product_id,
            expected: false,
            found: true,
          });
        }
        continue;
      }

      const { data: existingUnresolved } = await this.db
        .from('stock_count_items')
        .select('id, product_id')
        .eq('count_id', count.id)
        .eq('scanned_serial_number', scan.serial_number)
        .is('serial_id', null)
        .maybeSingle();

      if (existingUnresolved) {
        if (!existingUnresolved.product_id && scan.product_id) {
          await this.db.from('stock_count_items').update({ product_id: scan.product_id }).eq('id', existingUnresolved.id);
        }
      } else {
        await this.db.from('stock_count_items').insert({
          count_id: count.id,
          serial_id: null,
          scanned_serial_number: scan.serial_number,
          product_id: scan.product_id ?? null,
          expected: false,
          found: true,
        });
      }
    }

    return this.findById(id);
  }

  async accept(id: string, actorUser: AuthUser): Promise<StockCountDto> {
    await this.loadInProgress(id);

    const { data: unresolved } = await this.db
      .from('stock_count_items')
      .select('scanned_serial_number')
      .eq('count_id', id)
      .is('serial_id', null)
      .is('product_id', null);
    if (unresolved && unresolved.length > 0) {
      throw new BadRequestException(
        `${unresolved.length} scanned serial(s) still need a product assigned before this count can be accepted: ` +
          unresolved.map((r) => r.scanned_serial_number).join(', '),
      );
    }

    const before = await this.findById(id);
    const { error } = await this.db.rpc('accept_stock_count', {
      p_count_id: id,
      p_actor_id: actorUser.id,
      p_actor_role: actorUser.role ?? 'unknown',
    });
    if (error) {
      this.logger.error(`Failed to accept stock count ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to accept stock count');
    }

    const after = await this.findById(id);
    const missing = before.items.filter((i) => i.expected && !i.found).length;
    const unexpected = before.items.filter((i) => !i.expected && i.found).length;
    await this.auditLog.record({
      actor: actorUser,
      action: 'stock_counts.accept',
      resourceType: 'stock_counts',
      resourceId: id,
      before,
      after,
      metadata: { branchId: after.branch_id, missingCount: missing, unexpectedCount: unexpected },
    });
    return after;
  }

  async findAllForAdmin(filters: { branchId?: string; status?: string }): Promise<StockCountDto[]> {
    let query = this.db
      .from('stock_counts')
      .select('id, branch_id, status, started_at, completed_at')
      .order('started_at', { ascending: false });
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list stock counts: ${error.message}`);
      throw new InternalServerErrorException('Failed to list stock counts');
    }
    const headers = (data ?? []) as StockCountHeaderRow[];
    return Promise.all(headers.map((h) => this.attachItems(h)));
  }

  async findById(id: string): Promise<StockCountDto> {
    const { data, error } = await this.db
      .from('stock_counts')
      .select('id, branch_id, status, started_at, completed_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch stock count ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch stock count');
    }
    if (!data) throw new NotFoundException(`Stock count ${id} not found`);
    return this.attachItems(data as StockCountHeaderRow);
  }

  private async attachItems(header: StockCountHeaderRow): Promise<StockCountDto> {
    const { data, error } = await this.db
      .from('stock_count_items')
      .select('serial_id, scanned_serial_number, product_id, expected, found, product:products(name)')
      .eq('count_id', header.id);
    if (error) {
      this.logger.error(`Failed to load stock count ${header.id} items: ${error.message}`);
      throw new InternalServerErrorException('Failed to load stock count items');
    }

    type RawItem = {
      serial_id: string | null;
      scanned_serial_number: string | null;
      product_id: string | null;
      expected: boolean;
      found: boolean;
      product: EmbeddedProduct;
    };

    const items = ((data ?? []) as unknown as RawItem[]).map((row) => ({
      serial_id: row.serial_id,
      scanned_serial_number: row.scanned_serial_number,
      product_id: row.product_id,
      product_name: unwrapProduct(row.product)?.name ?? null,
      expected: row.expected,
      found: row.found,
    }));

    return { ...header, items };
  }
}
