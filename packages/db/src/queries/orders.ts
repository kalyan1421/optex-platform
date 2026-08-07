import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, Json } from '../database.types';

type OrderStatus = Database['public']['Enums']['order_status'];

export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;

export async function listOrdersForCustomer(
  db: SupabaseClient<Database>,
  customerId: string,
): Promise<Order[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Order writes are deliberately NOT available here.
 *
 * Placing an order goes through `POST /api/checkout`, which calls the atomic
 * `place_order` RPC (subtotal, promo validation, VAT, shipping, order_items and
 * cart clearing in one transaction). Status changes go through
 * `PATCH /api/admin/orders/:id/status`.
 */
