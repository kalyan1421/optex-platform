/**
 * Response shapes returned by the orders module. These are plain interfaces
 * (mirroring the cart module's `CartView` convention) rather than class-based
 * DTOs — they are output only and never validated. camelCase is used at the API
 * boundary while the DB stays snake_case.
 */

/** A single line on an order, joined to a lightweight product summary. */
export interface OrderItemView {
  id: string;
  productId: string;
  quantity: number;
  unitPriceKes: number;
  lineTotalKes: number;
  lensOption: unknown | null;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    image: string | null;
  } | null;
}

/** Compact order summary used in list endpoints (`GET /orders`). */
export interface OrderSummaryView {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalKes: number;
  discountKes: number;
  itemCount: number;
  createdAt: string;
}

/** Full order detail (`GET /orders/:id`), including line items + money breakdown. */
export interface OrderDetailView extends OrderSummaryView {
  subtotalKes: number;
  vatKes: number;
  shippingKes: number;
  promoCode: string | null;
  shipping: unknown | null;
  notes: string | null;
  items: OrderItemView[];
}

/** Admin list row: an order summary plus the customer's contact details. */
export interface AdminOrderSummaryView extends OrderSummaryView {
  customer: {
    id: string | null;
    email: string | null;
    fullName: string | null;
    phone: string | null;
  } | null;
}

/** Paginated envelope shared by the customer and admin list endpoints. */
export interface PaginatedOrders<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Outcome of a checkout. The `payment` block tells the client what to do next:
 * COD orders are accepted immediately (collect on delivery); mpesa/pesapal
 * orders require a follow-up call to the (separate) Payments module to initiate
 * the STK push / redirect, keyed by `orderId`.
 */
export interface PaymentInstruction {
  method: string;
  requiresPayment: boolean;
  status: 'confirmed' | 'pending_payment';
  orderId: string;
  amountKes: number;
  /** Human-readable next step for the client. */
  message: string;
}

/** Full response from `POST /checkout`. */
export interface CheckoutResultView {
  order: OrderDetailView;
  payment: PaymentInstruction;
}

/** One stage in the order tracking timeline (`GET /orders/:id/tracking`). */
export interface TrackingStageView {
  key: 'received' | 'processing' | 'dispatched' | 'delivered';
  label: string;
  /** true once the order has reached (or passed) this stage. */
  completed: boolean;
  /** true if this is the order's current stage. */
  current: boolean;
}

/** Tracking timeline for an order (`GET /orders/:id/tracking`). */
export interface OrderTrackingView {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  cancelled: boolean;
  stages: TrackingStageView[];
}
