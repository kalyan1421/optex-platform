import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
const unwrapProduct = (embed: EmbeddedProduct) =>
  Array.isArray(embed) ? (embed[0] ?? null) : embed;

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
    this.assertInScope(actorUser, dto.branch_id);
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
        throw new BadRequestException(
          'One or more serials are not currently in stock at that branch',
        );
      }
      if (error.message?.includes('serial_not_found')) {
        throw new BadRequestException('One or more serial ids do not exist');
      }
      if (error.message?.includes('invalid_reason_direction')) {
        throw new BadRequestException(
          'That reason code is not valid for this adjustment direction',
        );
      }
      throw new InternalServerErrorException('Failed to post adjustment');
    }

    const adjustmentId = data as string;
    const created = await this.findById(adjustmentId, actorUser);
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

  /**
   * Resolves the branch a request may act on.
   *
   * Audit B-03. These R2 surfaces took `branchId` straight off the query string
   * or request body with no reference to the caller, unlike `inventory.service`
   * and `ledger.service` in this same module, which both derive it from
   * `user.branchId`. Nothing is exposed by that today — `inventory.count`,
   * `inventory.adjust` and `inventory.transfer` are granted only to
   * `inventory_manager` and `super_admin` (migration 0026), neither of which is
   * branch-scoped — but the RBAC matrix is DATA, editable from the admin panel
   * without a deploy or a review. Granting one of these to a branch role would
   * silently open cross-branch access with no code change. Enforcing it here
   * while it is still a no-op is what keeps that from being true later.
   */
  private scopedBranch(user: AuthUser, requested?: string): string | undefined {
    return user.branchId ?? requested;
  }

  /** 404s a row outside a branch-scoped caller's branch (existence stays hidden). */
  private assertInScope(user: AuthUser, branchId: string | null): void {
    if (user.branchId && branchId !== user.branchId) {
      throw new NotFoundException('Adjustment not found');
    }
  }

  async findAllForAdmin(filters: { branchId?: string }, user: AuthUser): Promise<AdjustmentDto[]> {
    const branchId = this.scopedBranch(user, filters.branchId);
    let query = this.db
      .from('stock_adjustments')
      .select('id, branch_id, notes, created_at')
      .order('created_at', { ascending: false });
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list adjustments: ${error.message}`);
      throw new InternalServerErrorException('Failed to list adjustments');
    }
    const headers = (data ?? []) as AdjustmentHeaderRow[];
    return Promise.all(headers.map((h) => this.attachItems(h)));
  }

  async findById(id: string, user: AuthUser): Promise<AdjustmentDto> {
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
    this.assertInScope(user, (data as AdjustmentHeaderRow).branch_id);
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
      const productName =
        row.direction === 'remove'
          ? unwrapProduct(serialEmbed?.product ?? null)?.name
          : unwrapProduct(row.product)?.name;
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
