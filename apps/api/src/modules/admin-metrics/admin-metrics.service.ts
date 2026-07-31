import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { DASHBOARD_RANGE_DAYS, DashboardQueryDto, DashboardRange } from './dto/dashboard-query.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsResponse,
  CategoryRevenue,
  DailyRevenuePoint,
  DashboardKpis,
  DashboardResponse,
  OrderVolumePoint,
  RecentOrder,
  SalesSummary,
  TopProduct,
} from './dto/metrics-response.dto';

/**
 * Order `status` enum values that represent a real, fulfilled-or-fulfilling
 * sale (excludes `pending_payment`, `received`, and `cancelled`). Combined
 * with `payment_status = 'paid'` this is the canonical "counts as revenue"
 * filter — mirrored from `packages/db/src/queries/admin.ts` (H-3 fix) so the
 * API and the legacy query layer agree on what a sale is.
 */
const PAID_ORDER_STATUSES = ['processing', 'dispatched', 'delivered'] as const;

/** Payment status that confirms money was actually captured. */
const PAID_PAYMENT_STATUS = 'paid';

/**
 * Hard cap on rows fetched in a single bounded aggregation. The Supabase JS
 * client cannot GROUP BY, so we pull rows within the requested window and fold
 * them in TypeScript; this cap keeps a pathological history from fetching the
 * whole table. Long-term these should become Postgres GROUP BY RPCs.
 */
const ROW_CAP = 10000;

/** Largest analytics window we will service in one request (days). */
const MAX_ANALYTICS_DAYS = 366;

/** Default analytics window when `from`/`to` are omitted (days). */
const DEFAULT_ANALYTICS_DAYS = 30;

/** How many recent orders the dashboard returns. */
const RECENT_ORDERS_LIMIT = 10;

/** How many top products each report returns. */
const TOP_PRODUCTS_LIMIT = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimal row shapes pulled from Supabase for aggregation. */
interface OrderRevenueRow {
  total_kes: number | string;
  created_at: string;
}

interface OrderItemRow {
  product_id: string | null;
  quantity: number;
  unit_price_kes: number | string;
  product:
    | { name: string | null; sku: string | null; category_id: string | null }
    | { name: string | null; sku: string | null; category_id: string | null }[]
    | null;
}

/**
 * ADMIN METRICS — dashboard KPIs and analytics reporting.
 *
 * All methods use the service-role Supabase client (RLS-bypassing); the
 * controller restricts every route to `super_admin`, so reads here are
 * intentionally privileged. Revenue is always computed from paid, fulfilled
 * orders only (see {@link PAID_ORDER_STATUSES}).
 */
@Injectable()
export class AdminMetricsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Dashboard payload for the requested rolling window: KPIs, recent orders,
   * top products, and a per-day revenue time-series. Replaces the hardcoded
   * dashboard chart (MISSING_FEATURES A-4).
   */
  async dashboard(query: DashboardQueryDto): Promise<DashboardResponse> {
    const range = query.range ?? DashboardRange.Last30Days;
    const days = DASHBOARD_RANGE_DAYS[range];
    const to = new Date();
    const from = new Date(to.getTime() - days * MS_PER_DAY);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [paidOrders, customerCount, recentOrders, topProducts] = await Promise.all([
      this.fetchPaidOrderRevenue(fromIso, toIso),
      this.countCustomers(),
      this.fetchRecentOrders(RECENT_ORDERS_LIMIT),
      this.fetchTopProducts(fromIso, toIso, TOP_PRODUCTS_LIMIT),
    ]);

    const kpis = this.computeKpis(paidOrders, customerCount);
    const dailyRevenue = this.bucketByDay(paidOrders);

    return {
      range,
      from: fromIso,
      to: toIso,
      kpis,
      recentOrders,
      topProducts,
      dailyRevenue,
    };
  }

  /**
   * Analytics report for an explicit `from`/`to` window: sales summary,
   * top-products report, order-volume-by-day, and revenue-by-category.
   * Replaces the hardcoded analytics arrays (MISSING_FEATURES A-1). Full CR-01
   * analytics (velocity / margins) is out of scope here.
   */
  async analytics(query: AnalyticsQueryDto): Promise<AnalyticsResponse> {
    const { fromIso, toIso } = this.resolveAnalyticsRange(query);

    const [paidOrders, itemRows] = await Promise.all([
      this.fetchPaidOrderRevenue(fromIso, toIso),
      this.fetchPaidOrderItems(fromIso, toIso),
    ]);

    const summary = this.computeSummary(paidOrders, itemRows);
    const topProducts = this.aggregateTopProducts(itemRows, TOP_PRODUCTS_LIMIT);
    const orderVolumeByDay = this.bucketVolumeByDay(paidOrders);
    const revenueByCategory = await this.aggregateRevenueByCategory(itemRows);

    return {
      from: fromIso,
      to: toIso,
      summary,
      topProducts,
      orderVolumeByDay,
      revenueByCategory,
    };
  }

  // ───────────────────────── fetch helpers ──────────────────────────────────

  /**
   * Revenue rows (`total_kes`, `created_at`) for paid, fulfilled orders in the
   * window. Bounded by {@link ROW_CAP}.
   */
  private async fetchPaidOrderRevenue(fromIso: string, toIso: string): Promise<OrderRevenueRow[]> {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select('total_kes, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .in('status', [...PAID_ORDER_STATUSES])
      .eq('payment_status', PAID_PAYMENT_STATUS)
      .order('created_at', { ascending: true })
      .limit(ROW_CAP);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as OrderRevenueRow[];
  }

  /** Total registered customers (all-time). */
  private async countCustomers(): Promise<number> {
    const { count, error } = await this.supabase.client
      .from('customers')
      .select('id', { count: 'exact', head: true });

    if (error) throw new BadRequestException(error.message);
    return count ?? 0;
  }

  /** Latest orders joined to the customer email, newest first. */
  private async fetchRecentOrders(limit: number): Promise<RecentOrder[]> {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select(
        'id, order_number, total_kes, status, payment_status, payment_method, created_at, customer:customers!customer_id(email)',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((o) => {
      const row = o as {
        id: string;
        order_number: string;
        total_kes: number | string;
        status: string;
        payment_status: string;
        payment_method: string | null;
        created_at: string;
        customer: { email: string | null } | { email: string | null }[] | null;
      };
      const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
      return {
        id: row.id,
        orderNumber: row.order_number,
        customerEmail: customer?.email ?? null,
        totalKes: Number(row.total_kes),
        status: row.status,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        createdAt: row.created_at,
      };
    });
  }

  /**
   * Top products for the dashboard. Aggregates `order_items` joined to the
   * parent order so we can restrict to paid, fulfilled orders in the window
   * (`order_items` itself has no `created_at` / status of its own).
   */
  private async fetchTopProducts(
    fromIso: string,
    toIso: string,
    limit: number,
  ): Promise<TopProduct[]> {
    const rows = await this.fetchPaidOrderItems(fromIso, toIso);
    return this.aggregateTopProducts(rows, limit);
  }

  /**
   * `order_items` belonging to paid, fulfilled orders in the window. Filters
   * on the embedded parent order via PostgREST inner-join filters so only rows
   * whose order is a real sale come back. Bounded by {@link ROW_CAP}.
   */
  private async fetchPaidOrderItems(fromIso: string, toIso: string): Promise<OrderItemRow[]> {
    const { data, error } = await this.supabase.client
      .from('order_items')
      .select(
        'product_id, quantity, unit_price_kes, ' +
          'order:orders!inner(created_at, status, payment_status), ' +
          'product:products(name, sku, category_id)',
      )
      .gte('order.created_at', fromIso)
      .lte('order.created_at', toIso)
      .in('order.status', [...PAID_ORDER_STATUSES])
      .eq('order.payment_status', PAID_PAYMENT_STATUS)
      .limit(ROW_CAP);

    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as unknown as OrderItemRow[];
  }

  // ───────────────────────── aggregation helpers ────────────────────────────

  private computeKpis(orders: OrderRevenueRow[], customerCount: number): DashboardKpis {
    const totalRevenueKes = orders.reduce((sum, o) => sum + Number(o.total_kes), 0);
    const orderCount = orders.length;
    const averageOrderValueKes = orderCount > 0 ? totalRevenueKes / orderCount : 0;

    return {
      totalRevenueKes,
      orderCount,
      customerCount,
      averageOrderValueKes: this.round2(averageOrderValueKes),
    };
  }

  private computeSummary(orders: OrderRevenueRow[], items: OrderItemRow[]): SalesSummary {
    const totalRevenueKes = orders.reduce((sum, o) => sum + Number(o.total_kes), 0);
    const orderCount = orders.length;
    const unitsSold = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const averageOrderValueKes = orderCount > 0 ? totalRevenueKes / orderCount : 0;

    return {
      totalRevenueKes,
      orderCount,
      unitsSold,
      averageOrderValueKes: this.round2(averageOrderValueKes),
    };
  }

  /** Per-calendar-day revenue + order count, chronologically ordered. */
  private bucketByDay(orders: OrderRevenueRow[]): DailyRevenuePoint[] {
    const buckets = new Map<string, { revenueKes: number; orders: number }>();
    for (const o of orders) {
      const date = new Date(o.created_at).toISOString().slice(0, 10);
      const existing = buckets.get(date) ?? { revenueKes: 0, orders: 0 };
      existing.revenueKes += Number(o.total_kes);
      existing.orders += 1;
      buckets.set(date, existing);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        revenueKes: this.round2(v.revenueKes),
        orders: v.orders,
      }));
  }

  /** Same buckets as {@link bucketByDay} but shaped for the analytics report. */
  private bucketVolumeByDay(orders: OrderRevenueRow[]): OrderVolumePoint[] {
    return this.bucketByDay(orders).map((p) => ({
      date: p.date,
      orders: p.orders,
      revenueKes: p.revenueKes,
    }));
  }

  /** Fold order items into top-N products by revenue. */
  private aggregateTopProducts(items: OrderItemRow[], limit: number): TopProduct[] {
    const map = new Map<string, TopProduct>();
    for (const item of items) {
      if (!item.product_id) continue;
      const product = this.unwrapProduct(item.product);
      const lineRevenue = Number(item.quantity) * Number(item.unit_price_kes);
      const existing = map.get(item.product_id);
      if (existing) {
        existing.units += Number(item.quantity);
        existing.revenueKes += lineRevenue;
      } else {
        map.set(item.product_id, {
          productId: item.product_id,
          name: product?.name ?? 'Unknown product',
          sku: product?.sku ?? '',
          units: Number(item.quantity),
          revenueKes: lineRevenue,
        });
      }
    }
    return Array.from(map.values())
      .map((p) => ({ ...p, revenueKes: this.round2(p.revenueKes) }))
      .sort((a, b) => b.revenueKes - a.revenueKes)
      .slice(0, limit);
  }

  /**
   * Revenue grouped by product category. Folds the items by `category_id`,
   * then resolves names in a single `categories` lookup. Items whose product
   * has no category fall into an "Uncategorized" bucket.
   */
  private async aggregateRevenueByCategory(items: OrderItemRow[]): Promise<CategoryRevenue[]> {
    const byCategory = new Map<
      string,
      { categoryId: string | null; revenueKes: number; units: number }
    >();

    for (const item of items) {
      const product = this.unwrapProduct(item.product);
      const categoryId = product?.category_id ?? null;
      const key = categoryId ?? '__none__';
      const lineRevenue = Number(item.quantity) * Number(item.unit_price_kes);
      const existing = byCategory.get(key) ?? { categoryId, revenueKes: 0, units: 0 };
      existing.revenueKes += lineRevenue;
      existing.units += Number(item.quantity);
      byCategory.set(key, existing);
    }

    const categoryIds = Array.from(byCategory.values())
      .map((c) => c.categoryId)
      .filter((id): id is string => Boolean(id));

    const names = await this.fetchCategoryNames(categoryIds);

    return Array.from(byCategory.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryId
          ? (names.get(c.categoryId) ?? 'Unknown category')
          : 'Uncategorized',
        revenueKes: this.round2(c.revenueKes),
        units: c.units,
      }))
      .sort((a, b) => b.revenueKes - a.revenueKes);
  }

  /** Resolve category ids → names. Returns an empty map when given no ids. */
  private async fetchCategoryNames(ids: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return new Map();

    const { data, error } = await this.supabase.client
      .from('categories')
      .select('id, name')
      .in('id', unique);

    if (error) throw new BadRequestException(error.message);

    const map = new Map<string, string>();
    for (const row of (data ?? []) as { id: string; name: string }[]) {
      map.set(row.id, row.name);
    }
    return map;
  }

  // ───────────────────────── misc helpers ───────────────────────────────────

  /**
   * Resolve the analytics window. Defaults to the last
   * {@link DEFAULT_ANALYTICS_DAYS} days; `to` is pushed to end-of-day so a
   * calendar-date `to` includes the whole day. Rejects inverted ranges and
   * windows wider than {@link MAX_ANALYTICS_DAYS}.
   */
  private resolveAnalyticsRange(query: AnalyticsQueryDto): {
    fromIso: string;
    toIso: string;
  } {
    const now = new Date();
    const to = query.to ? this.endOfDay(query.to) : now;
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_ANALYTICS_DAYS * MS_PER_DAY);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid `from`/`to` date');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('`from` must be on or before `to`');
    }
    const spanDays = (to.getTime() - from.getTime()) / MS_PER_DAY;
    if (spanDays > MAX_ANALYTICS_DAYS) {
      throw new BadRequestException(`Date range too large (max ${MAX_ANALYTICS_DAYS} days)`);
    }

    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }

  /** Parse an ISO date/datetime and snap it to 23:59:59.999 of that day. */
  private endOfDay(iso: string): Date {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return d;
    // A bare `YYYY-MM-DD` parses as UTC midnight; only extend to end-of-day
    // when no time component was supplied so explicit datetimes are respected.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
      d.setUTCHours(23, 59, 59, 999);
    }
    return d;
  }

  /** Normalize PostgREST's embedded relation (object or single-item array). */
  private unwrapProduct(
    product: OrderItemRow['product'],
  ): { name: string | null; sku: string | null; category_id: string | null } | null {
    if (!product) return null;
    return Array.isArray(product) ? (product[0] ?? null) : product;
  }

  /** Round to 2 decimal places (KES cents) without float drift surprises. */
  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
