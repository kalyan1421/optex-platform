import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../database.types';

export type AdminProduct = Tables<'products'>;
export type AdminOrder = Tables<'orders'>;

/** Resolve the customers.id for a given auth.users.id. Returns null if not found. */
export async function getCustomerIdByAuthId(
  db: SupabaseClient<Database>,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('customers')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** List all products (including inactive) for admin use. */
export async function listAllProducts(db: SupabaseClient<Database>): Promise<AdminProduct[]> {
  const { data, error } = await db
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** List all orders for admin use, most recent first. */
export async function listAllOrders(
  db: SupabaseClient<Database>,
  limit = 100,
): Promise<AdminOrder[]> {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface DashboardStats {
  revenueMonth: number;
  ordersToday: number;
  totalCustomers: number;
  appointmentsToday: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  customer_email: string | null;
  total_kes: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export async function getDashboardStats(db: SupabaseClient<Database>): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const [monthOrders, todayOrders, customers, todayAppts] = await Promise.all([
    // H-3 FIX: Only count orders that have been paid to avoid inflating revenue
    // with cancelled orders, pending M-Pesa pushes, or failed payments.
    db
      .from('orders')
      .select('total_kes')
      .gte('created_at', startOfMonth)
      .in('status', ['processing', 'dispatched', 'delivered'])
      .eq('payment_status', 'paid'),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay),
    db.from('customers').select('id', { count: 'exact', head: true }),
    db
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('scheduled_at', startOfDay)
      .lt('scheduled_at', endOfDay),
  ]);

  const revenueMonth = (monthOrders.data ?? []).reduce((sum, o) => sum + Number(o.total_kes), 0);

  return {
    revenueMonth,
    ordersToday: todayOrders.count ?? 0,
    totalCustomers: customers.count ?? 0,
    appointmentsToday: todayAppts.count ?? 0,
  };
}

export interface TopProduct {
  product_id: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
}

/**
 * Aggregate order_items to find top-selling products by revenue.
 * Runs client-side aggregation since Supabase JS client doesn't expose GROUP BY.
 *
 * H-2 FIX: Added a 90-day date filter and a 5 000-row safety cap to prevent
 * fetching the entire order_items table on every dashboard load. Long-term,
 * replace with a Postgres GROUP BY RPC for O(1) bandwidth regardless of history.
 */
export async function getTopProducts(
  db: SupabaseClient<Database>,
  limit = 5,
): Promise<TopProduct[]> {
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('order_items')
    .select('product_id, quantity, unit_price_kes, product:products(name, sku)')
    .gte('created_at', since90d)
    .limit(5000); // safety cap — replace with GROUP BY RPC when order volume grows
  if (error) throw error;
  if (!data?.length) return [];

  const map = new Map<string, TopProduct>();
  for (const item of data) {
    const p = item.product as unknown as { name: string; sku: string } | null;
    if (!p || !item.product_id) continue;
    const existing = map.get(item.product_id);
    if (existing) {
      existing.units += item.quantity;
      existing.revenue += item.quantity * Number(item.unit_price_kes);
    } else {
      map.set(item.product_id, {
        product_id: item.product_id,
        name: p.name,
        sku: p.sku,
        units: item.quantity,
        revenue: item.quantity * Number(item.unit_price_kes),
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getRecentOrders(
  db: SupabaseClient<Database>,
  limit = 5,
): Promise<RecentOrder[]> {
  // M-5 FIX: Join to customers to resolve the email rather than leaving it null.
  const { data, error } = await db
    .from('orders')
    .select(
      'id, order_number, total_kes, status, payment_method, created_at, customer:customers!customer_id(email)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    customer_email: (o.customer as { email?: string | null } | null)?.email ?? null,
    total_kes: Number(o.total_kes),
    status: o.status,
    payment_method: o.payment_method,
    created_at: o.created_at,
  }));
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

export async function getRevenueByPeriod(
  db: SupabaseClient<Database>,
  period: '7D' | '30D' | '90D',
): Promise<RevenuePoint[]> {
  const now = new Date();
  let since: Date;
  if (period === '7D') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (period === '30D') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  else since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const { data, error } = await db
    .from('orders')
    .select('total_kes, created_at')
    .gte('created_at', since.toISOString())
    .in('status', ['processing', 'dispatched', 'delivered'])
    .eq('payment_status', 'paid');

  if (error) throw error;

  // Bucket by day (7D), week (30D), or month (90D).
  // M-4 FIX: Use an ISO-sortable string as the map key so that:
  //   (a) buckets spanning two calendar months don't collide on the display label
  //   (b) the returned array is always in chronological order
  // The display label is derived separately from the key.
  const buckets = new Map<string, { label: string; revenue: number; orders: number }>();

  for (const order of data ?? []) {
    const d = new Date(order.created_at);
    let sortKey: string;
    let label: string;

    if (period === '7D') {
      // One bucket per calendar day — ISO date is the key
      sortKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      label = d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' });
    } else if (period === '30D') {
      // One bucket per week. Key includes year + month to prevent Jan Wk1 / Feb Wk1 collision.
      const weekNum = Math.floor((d.getDate() - 1) / 7) + 1;
      sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
      label = `Wk ${weekNum} ${d.toLocaleDateString('en-KE', { month: 'short' })}`;
    } else {
      // One bucket per calendar month
      sortKey = d.toISOString().slice(0, 7); // YYYY-MM
      label = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
    }

    const existing = buckets.get(sortKey) ?? { label, revenue: 0, orders: 0 };
    existing.revenue += Number(order.total_kes);
    existing.orders += 1;
    buckets.set(sortKey, existing);
  }

  // Sort chronologically by the ISO sort key before stripping it
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ label: v.label, revenue: v.revenue, orders: v.orders }));
}

export interface PaymentMethodBreakdown {
  name: string;
  value: number;
}

export async function getPaymentMethodBreakdown(
  db: SupabaseClient<Database>,
): Promise<PaymentMethodBreakdown[]> {
  // H-4 FIX: Added limit + paid-only filter. Without a limit this fetches every
  // order row ever created for a 3-slice pie chart. Long-term replace with a
  // `GROUP BY payment_method` RPC that returns 3 aggregate rows directly.
  const { data, error } = await db
    .from('orders')
    .select('payment_method')
    .in('status', ['processing', 'dispatched', 'delivered'])
    .eq('payment_status', 'paid')
    .limit(10000);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const o of data ?? []) {
    const pm = o.payment_method ?? 'unknown';
    counts.set(pm, (counts.get(pm) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  return Array.from(counts.entries()).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}
