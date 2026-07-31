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
export interface DashboardResponse {
  range: string;
  from: string;
  to: string;
  kpis: DashboardKpis;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  dailyRevenue: DailyRevenuePoint[];
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
