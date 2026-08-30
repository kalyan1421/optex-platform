import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateGrnDto, CreateGrnItemDto, GrnDto, PostGrnDto } from './dto/grn.dto';

interface GrnHeaderRow {
  id: string;
  grn_number: string;
  supplier_id: string;
  branch_id: string;
  status: 'draft' | 'posted';
  notes: string | null;
  created_at: string;
  posted_at: string | null;
}

type EmbeddedProduct = { name: string; sku: string } | { name: string; sku: string }[] | null;
const unwrapProduct = (embed: EmbeddedProduct) =>
  Array.isArray(embed) ? (embed[0] ?? null) : embed;

/**
 * Goods-received-notes — the R2 receiving flow. Standalone against a
 * supplier, no Purchase Order to reconcile against (client confirmed out of
 * scope). A GRN is inert while `draft`: it reserves nothing and touches no
 * stock. Only `post()` — a single `SECURITY DEFINER` RPC (`post_grn`,
 * migration 0026) — creates `product_serials` rows, writes `stock_ledger`
 * 'received' entries, and increments the `inventory.stock` cache, all
 * atomically. Header/line creation before that point is plain sequential
 * inserts, same risk class as `orders.service.ts`'s pre-`place_order` cart
 * writes — nothing here can double-sell or corrupt the ledger, so it doesn't
 * need RPC-level atomicity.
 */
@Injectable()
export class GrnService {
  private readonly logger = new Logger(GrnService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  async create(dto: CreateGrnDto, actorUser: AuthUser): Promise<GrnDto> {
    const { data: header, error: headerError } = await this.db
      .from('goods_received_notes')
      .insert({ supplier_id: dto.supplier_id, branch_id: dto.branch_id, notes: dto.notes ?? null })
      .select('id, grn_number, supplier_id, branch_id, status, notes, created_at, posted_at')
      .single();
    if (headerError) {
      this.logger.error(`Failed to create GRN: ${headerError.message}`);
      throw new InternalServerErrorException('Failed to create GRN');
    }
    const grn = header as GrnHeaderRow;

    const { error: itemsError } = await this.db.from('goods_received_items').insert(
      dto.items.map((item) => ({
        grn_id: grn.id,
        product_id: item.product_id,
        unit_cost_kes: item.unit_cost_kes,
        quantity_ordered: item.quantity_ordered,
      })),
    );
    if (itemsError) {
      // Compensating delete — same pattern orders.service.ts uses when its
      // items insert fails after the order header already landed.
      await this.db.from('goods_received_notes').delete().eq('id', grn.id);
      this.logger.error(`Failed to create GRN items, rolled back header: ${itemsError.message}`);
      throw new InternalServerErrorException('Failed to create GRN');
    }

    const created = await this.findById(grn.id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'grn.create',
      resourceType: 'goods_received_notes',
      resourceId: grn.id,
      after: created,
      metadata: { branchId: dto.branch_id, supplierId: dto.supplier_id },
    });
    return created;
  }

  async findAllForAdmin(filters: {
    status?: string;
    supplierId?: string;
    branchId?: string;
  }): Promise<GrnDto[]> {
    let query = this.db
      .from('goods_received_notes')
      .select('id, grn_number, supplier_id, branch_id, status, notes, created_at, posted_at')
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list GRNs: ${error.message}`);
      throw new InternalServerErrorException('Failed to list GRNs');
    }
    const headers = (data ?? []) as GrnHeaderRow[];
    return Promise.all(headers.map((h) => this.attachItems(h)));
  }

  async findById(id: string): Promise<GrnDto> {
    const { data, error } = await this.db
      .from('goods_received_notes')
      .select('id, grn_number, supplier_id, branch_id, status, notes, created_at, posted_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch GRN ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch GRN');
    }
    if (!data) throw new NotFoundException(`GRN ${id} not found`);
    return this.attachItems(data as GrnHeaderRow);
  }

  private async loadDraft(id: string): Promise<GrnHeaderRow> {
    const { data, error } = await this.db
      .from('goods_received_notes')
      .select('id, grn_number, supplier_id, branch_id, status, notes, created_at, posted_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch GRN ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch GRN');
    }
    if (!data) throw new NotFoundException(`GRN ${id} not found`);
    const grn = data as GrnHeaderRow;
    if (grn.status !== 'draft') {
      throw new ConflictException('Only a draft GRN can be edited or posted');
    }
    return grn;
  }

  async replaceItems(id: string, items: CreateGrnItemDto[], actorUser: AuthUser): Promise<GrnDto> {
    const grn = await this.loadDraft(id);

    const { error: deleteError } = await this.db
      .from('goods_received_items')
      .delete()
      .eq('grn_id', grn.id);
    if (deleteError) {
      this.logger.error(`Failed to clear GRN ${id} items: ${deleteError.message}`);
      throw new InternalServerErrorException('Failed to update GRN items');
    }
    const { error: insertError } = await this.db.from('goods_received_items').insert(
      items.map((item) => ({
        grn_id: grn.id,
        product_id: item.product_id,
        unit_cost_kes: item.unit_cost_kes,
        quantity_ordered: item.quantity_ordered,
      })),
    );
    if (insertError) {
      this.logger.error(`Failed to insert GRN ${id} items: ${insertError.message}`);
      throw new InternalServerErrorException('Failed to update GRN items');
    }

    const updated = await this.findById(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'grn.update_items',
      resourceType: 'goods_received_notes',
      resourceId: id,
      after: updated,
    });
    return updated;
  }

  /**
   * Posts a draft GRN — validates the submitted serials against each line's
   * `quantity_ordered` before calling `post_grn` (migration 0026), which is
   * where the actual `product_serials`/`stock_ledger`/`inventory` writes
   * happen, atomically.
   */
  async post(id: string, dto: PostGrnDto, actorUser: AuthUser): Promise<GrnDto> {
    const grn = await this.loadDraft(id);

    const { data: items, error: itemsError } = await this.db
      .from('goods_received_items')
      .select('id, quantity_ordered')
      .eq('grn_id', grn.id);
    if (itemsError) {
      this.logger.error(`Failed to load GRN ${id} items: ${itemsError.message}`);
      throw new InternalServerErrorException('Failed to load GRN items');
    }
    const expectedByItem = new Map(
      (items ?? []).map((i) => [i.id as string, i.quantity_ordered as number]),
    );

    const submittedByItem = new Map<string, number>();
    for (const serial of dto.serials) {
      if (!expectedByItem.has(serial.grn_item_id)) {
        throw new BadRequestException(`${serial.grn_item_id} is not a line on this GRN`);
      }
      submittedByItem.set(serial.grn_item_id, (submittedByItem.get(serial.grn_item_id) ?? 0) + 1);
    }
    for (const [itemId, expected] of expectedByItem) {
      const submitted = submittedByItem.get(itemId) ?? 0;
      if (submitted !== expected) {
        throw new BadRequestException(
          `Line ${itemId} expected ${expected} serial(s) but received ${submitted}`,
        );
      }
    }

    const { error } = await this.db.rpc('post_grn', {
      p_grn_id: grn.id,
      p_serials: dto.serials,
      p_actor_id: actorUser.id,
      p_actor_role: actorUser.role ?? 'unknown',
    });
    if (error) {
      this.logger.error(`Failed to post GRN ${id}: ${error.message}`);
      if (error.code === '23505') {
        throw new BadRequestException('One of these serial numbers is already registered');
      }
      throw new InternalServerErrorException('Failed to post GRN');
    }

    const posted = await this.findById(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'grn.post',
      resourceType: 'goods_received_notes',
      resourceId: id,
      after: posted,
      metadata: {
        branchId: grn.branch_id,
        supplierId: grn.supplier_id,
        serialCount: dto.serials.length,
      },
    });
    return posted;
  }

  private async attachItems(header: GrnHeaderRow): Promise<GrnDto> {
    const { data, error } = await this.db
      .from('goods_received_items')
      .select('id, product_id, unit_cost_kes, quantity_ordered, product:products(name, sku)')
      .eq('grn_id', header.id);
    if (error) {
      this.logger.error(`Failed to load GRN ${header.id} items: ${error.message}`);
      throw new InternalServerErrorException('Failed to load GRN items');
    }

    type RawItem = {
      id: string;
      product_id: string;
      unit_cost_kes: number;
      quantity_ordered: number;
      product: EmbeddedProduct;
    };

    const items = ((data ?? []) as unknown as RawItem[]).map((row) => {
      const product = unwrapProduct(row.product);
      return {
        id: row.id,
        product_id: row.product_id,
        product_name: product?.name ?? null,
        product_sku: product?.sku ?? null,
        unit_cost_kes: row.unit_cost_kes,
        quantity_ordered: row.quantity_ordered,
      };
    });

    return { ...header, items };
  }
}
