import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AdjustmentDto, AdjustmentItemDto, CreateAdjustmentDto } from './dto/adjustment.dto';

interface AdjustmentHeaderRow {
  id: string;
  branch_id: string;
  notes: string | null;
  created_at: string;
}

type EmbeddedProduct = { name: string } | { name: string }[] | null;
const unwrapProduct = (embed: EmbeddedProduct) => (Array.isArray(embed) ? (embed[0] ?? null) : embed);

/**
 * Stock adjustments — R2 sub-phase 2c. One `SECURITY DEFINER` RPC
 * (`post_adjustment`, migration 0028) handles both directions in a single
 * call, since one physical walk can legitimately both write off a damaged
 * frame and log a frame the system had no record of.
 */
@Injectable()
export class AdjustmentsService {
  private readonly logger = new Logger(AdjustmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  /** `reason_code = 'found'` only makes sense on an `add` line — reject the mismatch here rather than in the DB layer. */
  private validateItems(items: AdjustmentItemDto[]): void {
    for (const item of items) {
      if (item.direction === 'remove') {
        if (!item.serial_id || item.product_id) {
          throw new BadRequestException("A 'remove' line needs serial_id and no product_id");
        }
        if (item.reason_code === 'found') {
          throw new BadRequestException("reason_code 'found' only applies to an 'add' line");
        }
      } else {
        if (!item.product_id || item.serial_id) {
          throw new BadRequestException("An 'add' line needs product_id and no serial_id");
        }
      }
    }
  }

  async create(dto: CreateAdjustmentDto, actorUser: AuthUser): Promise<AdjustmentDto> {
    this.validateItems(dto.items);

    const { data, error } = await this.db.rpc('post_adjustment', {
      p_branch_id: dto.branch_id,
      p_items: dto.items,
      p_actor_id: actorUser.id,
      p_actor_role: actorUser.role ?? 'unknown',
      p_notes: dto.notes ?? null,
    });
    if (error) {
      this.logger.error(`Failed to post adjustment: ${error.message}`);
      if (error.message?.includes('serial_not_in_stock_at_branch')) {
        throw new BadRequestException('One or more serials are not currently in stock at that branch');
      }
      if (error.message?.includes('serial_not_found')) {
        throw new BadRequestException('One or more serial ids do not exist');
      }
      if (error.message?.includes('invalid_reason_direction')) {
        throw new BadRequestException('That reason code is not valid for this adjustment direction');
      }
      throw new InternalServerErrorException('Failed to post adjustment');
    }

    const adjustmentId = data as string;
    const created = await this.findById(adjustmentId);
    await this.auditLog.record({
      actor: actorUser,
      action: 'adjustments.create',
      resourceType: 'stock_adjustments',
      resourceId: adjustmentId,
      after: created,
      metadata: { branchId: dto.branch_id, itemCount: dto.items.length },
    });
    return created;
  }

  async findAllForAdmin(filters: { branchId?: string }): Promise<AdjustmentDto[]> {
    let query = this.db
      .from('stock_adjustments')
      .select('id, branch_id, notes, created_at')
      .order('created_at', { ascending: false });
    if (filters.branchId) query = query.eq('branch_id', filters.branchId);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list adjustments: ${error.message}`);
      throw new InternalServerErrorException('Failed to list adjustments');
    }
    const headers = (data ?? []) as AdjustmentHeaderRow[];
    return Promise.all(headers.map((h) => this.attachItems(h)));
  }

  async findById(id: string): Promise<AdjustmentDto> {
    const { data, error } = await this.db
      .from('stock_adjustments')
      .select('id, branch_id, notes, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.logger.error(`Failed to fetch adjustment ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch adjustment');
    }
    if (!data) throw new NotFoundException(`Adjustment ${id} not found`);
    return this.attachItems(data as AdjustmentHeaderRow);
  }

  async listReasons(): Promise<{ id: string; description: string }[]> {
    const { data, error } = await this.db
      .from('stock_adjustment_reasons')
      .select('id, description')
      .order('id', { ascending: true });
    if (error) {
      this.logger.error(`Failed to list adjustment reasons: ${error.message}`);
      throw new InternalServerErrorException('Failed to list adjustment reasons');
    }
    return data ?? [];
  }

  private async attachItems(header: AdjustmentHeaderRow): Promise<AdjustmentDto> {
    const { data, error } = await this.db
      .from('stock_adjustment_items')
      .select(
        'serial_id, product_id, reason_code, direction, serial:product_serials(product:products(name)), product:products(name)',
      )
      .eq('adjustment_id', header.id);
    if (error) {
      this.logger.error(`Failed to load adjustment ${header.id} items: ${error.message}`);
      throw new InternalServerErrorException('Failed to load adjustment items');
    }

    type RawItem = {
      serial_id: string | null;
      product_id: string | null;
      reason_code: string;
      direction: 'add' | 'remove';
      serial: { product: EmbeddedProduct } | { product: EmbeddedProduct }[] | null;
      product: EmbeddedProduct;
    };

    const items = ((data ?? []) as unknown as RawItem[]).map((row) => {
      const serialEmbed = Array.isArray(row.serial) ? (row.serial[0] ?? null) : row.serial;
      const productName = row.direction === 'remove' ? unwrapProduct(serialEmbed?.product ?? null)?.name : unwrapProduct(row.product)?.name;
      return {
        serial_id: row.serial_id,
        product_id: row.product_id,
        product_name: productName ?? null,
        reason_code: row.reason_code,
        direction: row.direction,
      };
    });

    return { ...header, items };
  }
}
