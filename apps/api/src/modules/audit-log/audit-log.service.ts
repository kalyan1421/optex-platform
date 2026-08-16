import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AuthUser } from '../../auth/auth-user';
import type { AdminAuditLogQueryDto } from './dto/admin-audit-log-query.dto';
import type { AuditLogEntryDto, PaginatedAuditLog } from './dto/audit-log-entry.dto';

/** Fields `record()` accepts for one entry. */
export interface RecordAuditEntryInput {
  actor: AuthUser;
  /** `resource.verb`, e.g. `'staff.create'`, `'orders.status_change'`. */
  action: string;
  /** The table the mutated resource lives in, e.g. `'staff_users'`. */
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * AUDIT LOG — CR-01 R1 1d. Records every privileged mutation to `audit_log`
 * (migration 0025), retained indefinitely (SPEC-08: "3 months minimum" is a
 * floor, not a TTL).
 *
 * `record()` is called EXPLICITLY at each mutation site rather than via a
 * generic interceptor — this codebase has zero custom interceptors today
 * (grepped: the only `UseInterceptors` hits are Multer's stock
 * `FileInterceptor`), and a generic before/after capture would need the
 * domain object each service method already has loaded, buying less than it
 * costs in a codebase whose style is explicit throughout.
 *
 * Never throws. A failed audit write must not roll back or fail a mutation
 * that has already succeeded — logged as an error instead, the same
 * "observability failure isn't a business failure" posture as the
 * best-effort SMS/email sends elsewhere in this codebase (though unlike
 * those, this has no `notification_log`-style retry sweep; the plan's own
 * scope for 1d is capture, not delivery guarantees).
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    const { actor, action, resourceType, resourceId, before, after, metadata } = input;

    const { error } = await this.supabase.client.from('audit_log').insert({
      actor_user_id: actor.id,
      // Denormalized deliberately: reflects the actor's role/branch AT THE
      // TIME OF THE ACTION, not whatever they are now if it later changes.
      actor_role: actor.role ?? 'unknown',
      branch_id: actor.branchId ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      before: before ?? null,
      after: after ?? null,
      metadata: metadata ?? null,
    });

    if (error) {
      this.logger.error(
        `Failed to record audit entry (${action} on ${resourceType}): ${error.message}`,
      );
    }
  }

  async listForAdmin(query: AdminAuditLogQueryDto): Promise<PaginatedAuditLog> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.supabase.client
      .from('audit_log')
      .select(
        'id, actor_user_id, actor_role, action, resource_type, resource_id, branch_id, before, after, metadata, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.resourceType) builder = builder.eq('resource_type', query.resourceType);
    if (query.actorUserId) builder = builder.eq('actor_user_id', query.actorUserId);
    if (query.branchId) builder = builder.eq('branch_id', query.branchId);
    if (query.from) builder = builder.gte('created_at', query.from);
    if (query.to) builder = builder.lte('created_at', query.to);

    const { data, error, count } = await builder;
    if (error) {
      this.logger.error(`Failed to list audit log: ${error.message}`);
      throw error;
    }

    const total = count ?? 0;
    return {
      data: (data ?? []) as AuditLogEntryDto[],
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
