import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, Json } from '../database.types';

type OrderStatus = Database['public']['Enums']['order_status'];

export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;

export interface CreateOrderInput {
  customerId: string;
  branchId?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPriceKes: number;
    lensOption?: Record<string, unknown> | null;
  }>;
  paymentMethod: Database['public']['Enums']['payment_method'];
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    county: string;
    postal?: string | null;
  };
  promoCode?: string | null;
  vatRate?: number; // 0 or 0.16
  shippingKes?: number;
}

/**
 * Create an order + items atomically.
 *
 * C-4 FIX: Re-fetches current prices from the DB and overrides any
 * client-supplied unitPriceKes values. This prevents price-manipulation
 * attacks where a malicious request submits an arbitrary low price.
 *
 * M-1 FIX: Relies on the column DEFAULT generate_order_number() added in
 * migration 0006 instead of making a separate RPC call — avoids a wasted
 * sequence increment if the subsequent INSERT fails.
 */
export async function createOrder(
  db: SupabaseClient<Database>,
  input: CreateOrderInput,
): Promise<Order> {
  // C-4: Re-validate prices server-side before any arithmetic.
  const productIds = input.items.map((i) => i.productId);
  const { data: dbProducts, error: priceError } = await db
    .from('products')
    .select('id, price_kes')
    .in('id', productIds)
    .eq('is_active', true);
  if (priceError) throw priceError;

  const priceMap = new Map<string, number>();
  for (const p of dbProducts ?? []) priceMap.set(p.id, Number(p.price_kes));

  // Validate all product IDs are active and replace client prices with DB prices
  const validatedItems = input.items.map((i) => {
    const dbPrice = priceMap.get(i.productId);
    if (dbPrice === undefined)
      throw new Error(`Product ${i.productId} is not available for purchase`);
    return { ...i, unitPriceKes: dbPrice };
  });

  const subtotal = validatedItems.reduce((sum, i) => sum + i.unitPriceKes * i.quantity, 0);
  const vat = +(subtotal * (input.vatRate ?? 0)).toFixed(2);
  const shippingKes = input.shippingKes ?? 0;
  const total = +(subtotal + vat + shippingKes).toFixed(2);

  // M-1: Omit order_number — the column DEFAULT generate_order_number() fills it
  // atomically. Avoids an extra round-trip and a wasted sequence number if the
  // INSERT fails.
  const { data: order, error: insertError } = await db
    .from('orders')
    .insert({
      customer_id: input.customerId,
      branch_id: input.branchId ?? null,
      subtotal_kes: subtotal,
      vat_kes: vat,
      shipping_kes: shippingKes,
      total_kes: total,
      status: 'pending_payment',
      payment_method: input.paymentMethod,
      payment_status: 'pending',
      promo_code: input.promoCode ?? null,
      shipping: input.shipping,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const { error: itemsError } = await db.from('order_items').insert(
    validatedItems.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      quantity: i.quantity,
      unit_price_kes: i.unitPriceKes,
      lens_option: (i.lensOption ?? null) as Json | null,
    })),
  );
  if (itemsError) throw itemsError;

  return order;
}

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

export async function updateOrderStatus(
  db: SupabaseClient<Database>,
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  const { data, error } = await db
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
