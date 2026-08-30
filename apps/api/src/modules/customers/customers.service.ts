import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { escapeForPostgrestFilter } from '../../common/postgrest';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../../auth/auth-user';
import type { AdminCustomerDto } from './dto/customer.dto';
import type { CustomerStatus } from './dto/set-customer-status.dto';

/**
 * Columns selected from `customers`, with each customer's orders embedded.
 * Mirrors the query the admin Customers table previously ran directly against
 * Supabase from the browser.
 */
const CUSTOMER_COLUMNS =
  'id, full_name, email, phone, created_at, deactivated_at, orders(id, order_number, total_kes, status)';

/** A 100-year ban — GoTrue has no permanent-ban value, so this stands in for one. */
const BAN_FOREVER = '876000h';
/** GoTrue's own sentinel for "not banned". */
const BAN_LIFT = 'none';

/**
 * CUSTOMERS domain logic (admin-facing only — customers manage their own
 * profile through `/api/me`).
 *
 * Uses the service-role client, so RLS is bypassed; access is gated at the
 * controller by `@RequirePermission('customers.read'|'customers.write')`.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Lists customers, newest signup first, with their orders embedded.
   * `search` filters case-insensitively across name, email and phone.
   *
   * BRANCH SCOPING (audit A-01). `customers.read` is granted to `branch_staff`
   * and `branch_manager` — the two branch-scoped roles — but this method used
   * to take no actor at all and returned every customer in the country, with
   * name, email, phone and order history. Orders, appointments and inventory
   * all scope to the caller's branch; the table carrying the most personal
   * data did not.
   *
   * A customer has no `branch_id` of their own, so "this branch's customers"
   * has to be derived from a relationship. Appointments are the only one that
   * exists today: `appointments.branch_id` is NOT NULL (0001), while
   * `orders.branch_id` is nullable and `place_order` never sets it, so no
   * storefront order carries a branch at all — see the same note on
   * `orders.service.ts`'s `adminListOrders`. Scoping through orders would
   * therefore return nothing rather than something. When orders start
   * recording a fulfilment branch, add them here as a second `!inner` embed.
   *
   * Unscoped roles (`super_admin`) pass `undefined` and keep the full list.
   */
  async listForAdmin(search?: string, branchId?: string): Promise<AdminCustomerDto[]> {
    // `!inner` turns the embed into an inner join: only customers with at
    // least one appointment matching the filter below come back. The embedded
    // rows themselves are stripped before returning — they exist to filter,
    // not to be part of the response.
    const columns = branchId
      ? `${CUSTOMER_COLUMNS}, appointments!inner(branch_id)`
      : CUSTOMER_COLUMNS;

    let query = this.supabase.client
      .from('customers')
      .select(columns)
      .order('created_at', { ascending: false })
      // F-14: was unbounded — the admin table pulled every customer ever
      // registered on each visit. Search narrows it; this bounds the rest.
      .limit(500);

    if (branchId) {
      query = query.eq('appointments.branch_id', branchId);
    }

    if (search) {
      const safe = escapeForPostgrestFilter(search).trim();
      if (safe) {
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to load customers: ${error.message}`);
      throw new InternalServerErrorException('Failed to load customers');
    }

    return ((data ?? []) as unknown as (AdminCustomerDto & { appointments?: unknown })[]).map(
      ({ appointments: _appointments, ...customer }) => customer as AdminCustomerDto,
    );
  }

  /**
   * Sets a customer's account status. Deactivating bans the linked
   * `auth.users` row via the Supabase Admin API (so the customer genuinely
   * cannot sign in, not just a display flag) before persisting
   * `deactivated_at` — if the ban call fails, the row is left untouched
   * rather than recording a deactivation that didn't actually take effect.
   * Reactivating lifts the ban first, same ordering, same reasoning.
   *
   * Idempotent: setting a customer to the status it already has is a no-op
   * that still returns the current row, mirroring
   * `PrescriptionsService#updateStatusAsAdmin`.
   */
  async setStatusAsAdmin(
    id: string,
    status: CustomerStatus,
    actorUser: AuthUser,
  ): Promise<AdminCustomerDto> {
    const { data: existing, error: fetchError } = await this.supabase.client
      .from('customers')
      .select('id, auth_user_id, deactivated_at')
      .eq('id', id)
      .maybeSingle<{ id: string; auth_user_id: string | null; deactivated_at: string | null }>();

    if (fetchError) {
      this.logger.error(`Failed to load customer ${id}: ${fetchError.message}`);
      throw new InternalServerErrorException('Failed to load customer');
    }
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const currentStatus: CustomerStatus = existing.deactivated_at ? 'deactivated' : 'active';
    if (currentStatus === status) {
      return this.fetchOneForAdmin(id);
    }

    // A row without a linked auth user (e.g. never completed signup) has
    // nothing to ban — only the flag on `customers` is meaningful for it.
    if (existing.auth_user_id) {
      const { error: banError } = await this.supabase.client.auth.admin.updateUserById(
        existing.auth_user_id,
        { ban_duration: status === 'deactivated' ? BAN_FOREVER : BAN_LIFT },
      );
      if (banError) {
        this.logger.error(
          `Failed to ${status === 'deactivated' ? 'ban' : 'unban'} auth user for customer ${id}: ${banError.message}`,
        );
        throw new InternalServerErrorException(`Failed to set customer status`);
      }
    }

    const { error: updateError } = await this.supabase.client
      .from('customers')
      .update({ deactivated_at: status === 'deactivated' ? new Date().toISOString() : null })
      .eq('id', id);

    if (updateError) {
      this.logger.error(`Failed to update customer ${id}: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to update customer');
    }

    const after = await this.fetchOneForAdmin(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'customers.status_change',
      resourceType: 'customers',
      resourceId: id,
      metadata: { status },
      after,
    });
    return after;
  }

  private async fetchOneForAdmin(id: string): Promise<AdminCustomerDto> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to load customer');
    }
    if (!data) {
      throw new NotFoundException('Customer not found');
    }
    return data as unknown as AdminCustomerDto;
  }
}
