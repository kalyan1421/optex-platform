import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { AdminCustomerDto } from './dto/customer.dto';

/**
 * Columns selected from `customers`, with each customer's orders embedded.
 * Mirrors the query the admin Customers table previously ran directly against
 * Supabase from the browser.
 */
const CUSTOMER_COLUMNS =
  'id, full_name, email, phone, created_at, orders(id, order_number, total_kes, status)';

/**
 * CUSTOMERS domain logic (admin-facing only — customers manage their own
 * profile through `/api/me`).
 *
 * Uses the service-role client, so RLS is bypassed; access is gated at the
 * controller by `@Roles('super_admin')`.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists every customer, newest signup first, with their orders embedded.
   * `search` filters case-insensitively across name, email and phone.
   */
  async listForAdmin(search?: string): Promise<AdminCustomerDto[]> {
    let query = this.supabase.client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .order('created_at', { ascending: false });

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
}
