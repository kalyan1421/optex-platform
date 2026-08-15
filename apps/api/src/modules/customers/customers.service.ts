import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
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
 * controller by `@Roles('super_admin')`.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists every customer, newest signup first, with their orders embedded.
   * `search` filters case-insensitively across name, email and phone.
   */
  async listForAdmin(search?: string): Promise<AdminCustomerDto[]> {
    let query = this.supabase.client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .order('created_at', { ascending: false })
      // F-14: was unbounded — the admin table pulled every customer ever
      // registered on each visit. Search narrows it; this bounds the rest.
      .limit(500);

    if (search) {
      // Escape PostgREST's `or` filter delimiters so a comma or paren in the
      // search term can't break out of the filter expression.
      const safe = search.replace(/[(),]/g, ' ').trim();
      if (safe) {
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException('Failed to load customers');
    }

    return (data ?? []) as unknown as AdminCustomerDto[];
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
  async setStatusAsAdmin(id: string, status: CustomerStatus): Promise<AdminCustomerDto> {
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

    return this.fetchOneForAdmin(id);
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
