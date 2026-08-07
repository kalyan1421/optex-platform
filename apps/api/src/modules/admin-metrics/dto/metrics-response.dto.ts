/**
 * Response shapes for the admin-metrics endpoints.
 *
 * These are plain interfaces (not class-validator DTOs) — they describe
 * server-produced payloads, so there is nothing to validate on the way in.
 * They are documented via Swagger at the controller using `@ApiOkResponse`
 * with a `schema`, since interfaces are erased at runtime.
 */

/** A single high-level KPI tile on the dashboard. */
export interface DashboardKpis {
  /** Sum of `total_kes` over completed, paid orders in the window. */
  totalRevenueKes: number;
  /** Count of completed, paid orders in the window. */
  orderCount: number;
  /** Total registered customers (all-time, not window-bound). */
  customerCount: number;
  /** `totalRevenueKes / orderCount`, or 0 when there are no orders. */
  averageOrderValueKes: number;
}

/** A recent order row for the dashboard's "latest orders" list. */
export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string | null;
  totalKes: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  createdAt: string;
}

/** A top-selling product aggregated from `order_items`. */
export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenueKes: number;
}

/** One point on the daily revenue time-series. */
export interface DailyRevenuePoint {
  /** ISO calendar date `YYYY-MM-DD`. */
  date: string;
  revenueKes: number;
  orders: number;
}

/** Full `GET /admin/dashboard` payload. */
/**
 * Share of paid orders by payment rail, for the dashboard breakdown (G-4).
 * `share` is a percentage of order COUNT. Orders with no recorded method are
 * grouped under `unknown` so the shares always total 100.
 */
export interface PaymentMethodBreakdown {
  method: string;
  orders: number;
  revenueKes: number;
  share: number;
}

/**
 * Point-in-time figures that do NOT vary with the selected range.
 *
 * The admin panel's KPI cards read "Revenue (Month)", "Orders Today" and
 * "Appointments Today" — calendar-scoped questions the range-scoped `kpis`
 * block cannot answer. Both are served rather than conflated, because
 * "revenue over the last 30 days" and "revenue this calendar month" are
 * different numbers and the cards claim the latter.
 */
export interface DashboardSnapshot {
  /** Paid revenue since the 1st of the current calendar month. */
  revenueMonthKes: number;
  /** Orders created today, any status. */
  ordersToday: number;
  /** Appointments scheduled for today. */
  appointmentsToday: number;
}

export interface DashboardResponse {
  range: string;
  from: string;
  to: string;
  kpis: DashboardKpis;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  dailyRevenue: DailyRevenuePoint[];
  paymentMethods: PaymentMethodBreakdown[];
  snapshot: DashboardSnapshot;
}

/** Sales summary block for the analytics report. */
export interface SalesSummary {
  totalRevenueKes: number;
  orderCount: number;
  unitsSold: number;
  averageOrderValueKes: number;
}

/** One bucket of the order-volume-by-day series. */
export interface OrderVolumePoint {
  date: string;
  orders: number;
  revenueKes: number;
}

/** Revenue grouped by product category. */
export interface CategoryRevenue {
  categoryId: string | null;
  categoryName: string;
  revenueKes: number;
  units: number;
  /**
   * Revenue change vs the preceding window of equal length, as a percentage.
   * `null` when that window had no revenue for this category — "no prior data"
   * and "flat" are different answers, and a 0% badge on a brand-new category
   * would be misleading.
   */
  growthPct: number | null;
}

/** Full `GET /admin/analytics` payload. */
export interface AnalyticsResponse {
  from: string;
  to: string;
  summary: SalesSummary;
  topProducts: TopProduct[];
  orderVolumeByDay: OrderVolumePoint[];
  revenueByCategory: CategoryRevenue[];
}
