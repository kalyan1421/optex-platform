/**
 * Shared request + response types for the OPTEX NestJS API.
 *
 * These are hand-mirrored from the controllers and DTOs under
 * `apps/api/src/modules/*`. They are the TypeScript expression of the API
 * contract: the API serves what these describe, and `apps/web` / `apps/admin`
 * consume it. Keep this file in lock-step with the API DTOs.
 *
 * Conventions, taken from the API:
 * - The API boundary is camelCase for computed "view" payloads (cart, orders,
 *   payments, metrics) but snake_case for rows that mirror DB tables directly
 *   (products, categories, branches, prescriptions, reviews, appointments,
 *   promo codes/banners, me-profile). Both are reproduced faithfully here.
 * - Money is always in KES as a plain number (e.g. `priceKes`, `total_kes`).
 * - Timestamps are ISO-8601 strings.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared envelopes
// ─────────────────────────────────────────────────────────────────────────────

/** Paginated envelope used by the catalog list/search endpoints. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Error envelope produced by `apps/api/src/common/all-exceptions.filter.ts`.
 * `message` may be a string or an array of strings (class-validator errors).
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  error: string;
  message: string | string[];
  path: string;
  requestId?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog — products + categories
// ─────────────────────────────────────────────────────────────────────────────

/** Allowed sort orders for `GET /products` (`ProductSort` enum). */
export type ProductSort = 'price_asc' | 'price_desc' | 'newest' | 'featured';

/**
 * A product row (`select('*')` on the `products` table). The API types this
 * loosely (`Record<string, unknown> & {...}`); the known columns are spelled
 * out here, with an index signature for forward-compatibility.
 */
export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  frame_material: string | null;
  frame_shape: string | null;
  gender: string | null;
  description: string | null;
  price_kes: number;
  images: string[];
  try_on_image_url: string | null;
  is_active: boolean;
  /**
   * Mean of approved review ratings, one decimal, or null when there are none.
   *
   * Denormalised onto `products` and maintained by trigger (migration 0024) so
   * listings can show stars without a per-product round trip — audit F-11 was
   * that ratings appeared only on the PDP, and could not cheaply appear
   * anywhere else.
   */
  rating_avg: number | null;
  /** Number of approved reviews. Maintained alongside `rating_avg`. */
  rating_count: number;
  created_at: string;
  [key: string]: unknown;
}

/** A category row (`select('*')` on the `categories` table). */
export interface Category {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  [key: string]: unknown;
}

/** Query for `GET /products` — every filter is optional. */
export interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  shape?: string;
  gender?: string;
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

/** Query for `GET /products/search`. `q` is required. */
export interface ProductSearchQuery {
  q: string;
  page?: number;
  limit?: number;
}

/** Body for `POST /products` (admin). Mirrors `CreateProductDto`. */
export interface CreateProductInput {
  sku: string;
  slug: string;
  name: string;
  category_id: string;
  brand?: string;
  frame_material?: string;
  frame_shape?: string;
  gender?: string;
  description?: string;
  price_kes: number;
  images?: string[];
  try_on_image_url?: string;
  is_active?: boolean;
}

/** Body for `PATCH /products/:id` (admin). Mirrors `UpdateProductDto`. */
export type UpdateProductInput = Partial<CreateProductInput>;

/** Response of `DELETE /products/:id` (soft-delete). */
export interface ProductDeactivationResult {
  id: string;
  is_active: boolean;
}

/** Response of `POST /products/:id/images`. */
export interface ProductImageUploadResult {
  url: string;
  product: Product;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────────────────────────────────────

/** Promo discount kind, as used across cart / promotions. */
export type DiscountType = 'percent' | 'fixed';

/** A single cart line joined to its product (`CartItemView`). */
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  lensOption: unknown | null;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    priceKes: number;
    image: string | null;
  };
  lineTotalKes: number;
}

/** Applied-promo summary embedded in the cart (`AppliedPromoView`). */
export interface AppliedPromo {
  code: string;
  discountType: DiscountType;
  value: number;
  discountKes: number;
}

/** Fully-computed cart returned by every cart endpoint (`CartView`). */
export interface Cart {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  subtotalKes: number;
  promo: AppliedPromo | null;
  discountKes: number;
  vatKes: number;
  totalKes: number;
}

/** Body for `POST /cart/items` (`AddCartItemDto`). */
export interface AddCartItemInput {
  productId: string;
  quantity?: number;
}

/** Body for `PATCH /cart/items/:id` (`UpdateCartItemDto`). 0 removes the line. */
export interface UpdateCartItemInput {
  quantity: number;
}

/** Body for `POST /cart/apply-promo` (`ApplyPromoDto`). */
export interface ApplyPromoInput {
  code: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders — checkout, history, tracking, admin
// ─────────────────────────────────────────────────────────────────────────────

/** `order_status` enum. */
export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

/** `payment_status` enum. */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/** Accepted payment methods at checkout (`CheckoutPaymentMethod`). */
export type CheckoutPaymentMethod = 'cod' | 'mpesa' | 'pesapal';

/** Delivery vs. branch pickup (`CheckoutDeliveryOption`). */
export type CheckoutDeliveryOption = 'delivery' | 'pickup';

/** Delivery / shipping address captured at checkout (`ShippingAddressDto`). */
export interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postal?: string;
}

/**
 * Body for `POST /checkout` (`CheckoutDto`). Deliberately carries NO monetary
 * fields — every amount is recomputed server-side.
 */
export interface CheckoutInput {
  paymentMethod: CheckoutPaymentMethod;
  shippingAddress: ShippingAddress;
  deliveryOption?: CheckoutDeliveryOption;
  promoCode?: string;
}

/** A single order line joined to a product summary (`OrderItemView`). */
export interface OrderItem {
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

// ─────────────────────────────────────────────────────────────────────────────
// Auth (API-proxied Supabase GoTrue)
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /auth/login`. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Body for `POST /auth/signup`. */
export interface SignupInput {
  email: string;
  password: string;
  fullName?: string;
}

/** Body for `POST /auth/refresh`. */
export interface RefreshInput {
  refreshToken: string;
}

/** Body for `POST /auth/forgot-password` (audit F-22). */
export interface ForgotPasswordInput {
  email: string;
}

/**
 * Body for `POST /auth/reset-password` (audit F-22). No email or user id here
 * — the caller's identity comes from the bearer token, which is the recovery
 * session Supabase attaches to the reset-link redirect.
 */
export interface ResetPasswordInput {
  password: string;
}

/** Normalized authenticated user. */
export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
}

/** A session from login / signup / refresh. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AuthUser;
}

/** Result of login / signup / refresh. `session` is null only on signup that
 *  requires email confirmation. */
export interface AuthResult {
  session: Session | null;
  user: AuthUser;
}

/** Compact order summary used in list endpoints (`OrderSummaryView`). */
export interface OrderSummary {
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

/** Full order detail (`OrderDetailView`). */
export interface OrderDetail extends OrderSummary {
  subtotalKes: number;
  vatKes: number;
  shippingKes: number;
  promoCode: string | null;
  shipping: unknown | null;
  notes: string | null;
  items: OrderItem[];
}

/** Admin list row: order summary plus the customer's contact details. */
export interface AdminOrderSummary extends OrderSummary {
  customer: {
    id: string | null;
    email: string | null;
    fullName: string | null;
    phone: string | null;
  } | null;
}

/**
 * Paginated envelope shared by the customer and admin order list endpoints
 * (`PaginatedOrders<T>`). Note: this uses `data` + `totalPages`, unlike the
 * catalog `Paginated<T>` (which uses `items`).
 */
export interface PaginatedOrders<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Next-step payment instruction returned by checkout (`PaymentInstruction`). */
export interface PaymentInstruction {
  method: string;
  requiresPayment: boolean;
  status: 'confirmed' | 'pending_payment';
  orderId: string;
  amountKes: number;
  message: string;
}

/** Full response from `POST /checkout` (`CheckoutResultView`). */
export interface CheckoutResult {
  order: OrderDetail;
  payment: PaymentInstruction;
}

/** One stage in the order tracking timeline (`TrackingStageView`). */
export interface TrackingStage {
  key: 'received' | 'processing' | 'dispatched' | 'delivered';
  label: string;
  completed: boolean;
  current: boolean;
}

/** Tracking timeline for an order (`OrderTrackingView`). */
export interface OrderTracking {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  cancelled: boolean;
  stages: TrackingStage[];
}

/** Query for `GET /orders` (`ListOrdersQueryDto`). */
export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
}

/** Query for `GET /admin/orders` (`AdminListOrdersQueryDto`). */
export interface AdminListOrdersQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Filter by payment method, e.g. `cod` for the cash-on-delivery ledger. */
  paymentMethod?: CheckoutPaymentMethod;
  page?: number;
  pageSize?: number;
}

/** Body for `PATCH /admin/orders/:id/status` (`AdminOrderStatusDto`). */
export interface AdminOrderStatusInput {
  status: OrderStatus;
  note?: string;
}

/** Body for `PATCH /admin/orders/:id/cancel` (`AdminDirectCancelDto`) — SPEC-06 R3. */
export interface AdminOrderCancelInput {
  reason?: string;
  acknowledgePaid?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments — M-Pesa + Pesapal + admin ledger
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /payments/mpesa/stk-push` (`MpesaStkPushDto`). */
export interface MpesaStkPushInput {
  orderId: string;
  phone: string;
}

/** Result of initiating an M-Pesa STK push (`MpesaStkPushResult`). */
export interface MpesaStkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string | null;
  message: string;
}

/** Body for `POST /payments/mpesa/query` (`MpesaQueryDto`). */
export interface MpesaQueryInput {
  checkoutRequestId: string;
}

/** Resolved M-Pesa STK push status (`MpesaStatusView`). */
export interface MpesaStatus {
  checkoutRequestId: string;
  resultCode: number | null;
  resultDesc: string | null;
  /** Local transaction status (pending | matched | failed | reversed). */
  status: string;
  orderId: string | null;
  paid: boolean;
}

/** Body for `POST /payments/pesapal/initiate` (`PesapalInitiateDto`). */
export interface PesapalInitiateInput {
  orderId: string;
}

/** Result of initiating a Pesapal payment (`PesapalInitiateResult`). */
export interface PesapalInitiateResult {
  orderTrackingId: string;
  redirectUrl: string;
  message: string;
}

/** Query for `GET /payments/pesapal/status` (`PesapalStatusQueryDto`). */
export interface PesapalStatusQuery {
  orderTrackingId: string;
}

/** Resolved Pesapal transaction status (`PesapalStatusView`). */
export interface PesapalStatus {
  orderTrackingId: string;
  paymentStatusDescription: string | null;
  statusCode: number | null;
  /** Local transaction status (pending | matched | failed | reversed). */
  status: string;
  orderId: string | null;
  paid: boolean;
}

/** Payment provider (used by admin list filter + reconcile). */
export type PaymentProvider = 'mpesa' | 'pesapal';

/** Query for `GET /admin/payments` (`AdminListPaymentsQueryDto`). */
export interface AdminListPaymentsQuery {
  provider?: PaymentProvider;
  /** pending | matched | failed | reversed */
  status?: string;
  orderId?: string;
  page?: number;
  pageSize?: number;
}

/** A unified payment-transaction row for the admin list (`AdminPaymentView`). */
export interface AdminPayment {
  id: string;
  provider: PaymentProvider;
  reference: string;
  amountKes: number | null;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  customerPhone: string | null;
  method: string | null;
  receivedAt: string;
}

/**
 * Paginated payments envelope (`PaginatedPayments<T>`). Note: uses `items` and
 * has NO `totalPages` (distinct from `PaginatedOrders<T>`).
 */
export interface PaginatedPayments<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Body for `POST /admin/payments/:id/reconcile` (`ReconcilePaymentDto`). */
export interface ReconcilePaymentInput {
  provider: PaymentProvider;
}

/** Body for `POST /admin/payments/:id/link` (`LinkPaymentDto`). */
export interface LinkPaymentInput {
  provider: PaymentProvider;
  /** Human-readable order number to link the orphan payment to. */
  orderNumber: string;
}

/** Result of an admin reconcile action (`ReconcileResult`). */
export interface ReconcileResult {
  provider: PaymentProvider;
  transactionId: string;
  previousStatus: string;
  status: string;
  orderId: string | null;
  orderMarkedPaid: boolean;
  changed: boolean;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointments
// ─────────────────────────────────────────────────────────────────────────────

/** `appt_status` enum. */
export type AppointmentStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';

/** Recognized appointment kinds (`appointments.type` free-text column). */
export type AppointmentType = 'eye_test' | 'frame_fitting' | 'consultation';

/** An `appointments` row (`AppointmentDto`). */
export interface Appointment {
  id: string;
  customer_id: string | null;
  branch_id: string;
  type: string;
  /** UTC ISO-8601 timestamptz. */
  scheduled_at: string;
  status: AppointmentStatus;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

/** Query for `GET /appointments/slots` (`SlotsQueryDto`). */
export interface SlotsQuery {
  branchId: string;
  /** YYYY-MM-DD (Africa/Nairobi). */
  date: string;
}

/** Response of `GET /appointments/slots` (`SlotsResponseDto`). */
export interface Slots {
  branchId: string;
  date: string;
  /** Free 30-minute slot start times as 24h HH:MM, ascending. */
  slots: string[];
}

/** Body for `POST /appointments` (`CreateAppointmentDto`). */
export interface CreateAppointmentInput {
  branchId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 24h HH:MM */
  time: string;
  type?: AppointmentType;
  notes?: string;
}

/**
 * An appointment as returned by `GET /admin/appointments` — the base row plus
 * resolved customer and branch names (gap G-9). `customer` is null for
 * admin-created walk-in bookings, which carry `contact_name`/`contact_phone`.
 */
export interface AdminAppointment extends Appointment {
  customer: { full_name: string | null; email: string | null; phone: string | null } | null;
  branch: { name: string } | null;
}

/** Body for `PATCH /appointments/:id/reschedule` (`RescheduleAppointmentDto`). */
export interface RescheduleAppointmentInput {
  /** YYYY-MM-DD */
  date: string;
  /** 24h HH:MM */
  time: string;
}

/** Query for `GET /admin/appointments` (`AdminAppointmentQueryDto`). */
export interface AdminAppointmentQuery {
  branchId?: string;
  status?: AppointmentStatus;
  /** YYYY-MM-DD */
  date?: string;
}

/** Body for `PATCH /admin/appointments/:id` (`UpdateAppointmentDto`). */
export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  /** YYYY-MM-DD — supply with `time` to move the slot. */
  date?: string;
  /** 24h HH:MM — supply with `date` to move the slot. */
  time?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescriptions
// ─────────────────────────────────────────────────────────────────────────────

/** A `prescriptions` row (`PrescriptionRow`). */
export interface Prescription {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  file_url: string | null;
  sphere_od: number | null;
  sphere_os: number | null;
  cyl_od: number | null;
  cyl_os: number | null;
  axis_od: number | null;
  axis_os: number | null;
  pd: number | null;
  /** `pres_status` enum — mirrors the database, not a free-form string. */
  status: PrescriptionStatus;
  processed_at: string | null;
  created_at: string;
}

/** Values of the `pres_status` enum. */
export type PrescriptionStatus = 'pending' | 'processed';

/**
 * Body for `PATCH /admin/prescriptions/:id` (`UpdatePrescriptionStatusDto`).
 * `processed_at` is server-derived and deliberately not accepted here.
 */
export interface UpdatePrescriptionStatusInput {
  status: PrescriptionStatus;
}

/**
 * Optional measurement fields submitted alongside a prescription file upload
 * (`UploadPrescriptionDto`). Sent as multipart form-data fields together with
 * the binary `file`.
 */
export interface UploadPrescriptionFields {
  sphere_od?: number;
  sphere_os?: number;
  cyl_od?: number;
  cyl_os?: number;
  axis_od?: number;
  axis_os?: number;
  pd?: number;
  order_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Addresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A saved address (`AddressRow`). Field names deliberately match
 * `ShippingAddressDto` (`name`, `phone`, `address`, `city`, `county`,
 * `postal`) so a saved row maps onto the checkout payload with no
 * translation.
 */
export interface Address {
  id: string;
  customer_id: string;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postal: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Body for `POST /addresses` (`CreateAddressDto`). */
export interface CreateAddressInput {
  label?: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postal?: string;
  isDefault?: boolean;
}

/** Body for `PATCH /addresses/:id` (`UpdateAddressDto`) — every field optional. */
export type UpdateAddressInput = Partial<CreateAddressInput>;

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────

/** A saved product (`WishlistItemView`), with enough product data to render the wishlist page in one call. */
export interface WishlistItem {
  productId: string;
  addedAt: string;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    priceKes: number;
    image: string | null;
    /** `false` means discontinued/deactivated — the row survives, the product just isn't purchasable. */
    isActive: boolean;
  };
}

/** Query for `GET /admin/prescriptions` (`PrescriptionQueryDto`). */
export interface PrescriptionQuery {
  /** Filter by `customers.id` (the `prescriptions.customer_id` value). */
  customerId?: string;
}

/** A short-lived signed download URL (prescriptions download endpoints). */
export interface SignedDownloadUrl {
  url: string;
  expiresIn: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

/** `review_status` enum. */
export type ReviewStatus = 'pending' | 'approved' | 'flagged';

/** A `product_reviews` row (`ReviewDto`). No `title` column exists. */
export interface Review {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  admin_reply: string | null;
  /**
   * True when the author had ordered this product at the time of writing
   * (migration 0024, audit F-12). Set once at insert and never recomputed, so a
   * later refund does not rewrite what was true when they wrote it.
   */
  verified_purchase: boolean;
  created_at: string;
}

/**
 * A review as listed in the admin moderation table (`AdminReviewDto`), with the
 * author and product names resolved so the UI has more than uuids to render.
 */
export interface AdminReview extends Review {
  customer_name: string | null;
  product_name: string | null;
}

/** Aggregate rating summary (`ReviewAggregateDto`). */
export interface ReviewAggregate {
  averageRating: number | null;
  count: number;
}

/** Public response for `GET /products/:productId/reviews` (`ProductReviewsResponseDto`). */
export interface ProductReviews {
  reviews: Review[];
  aggregate: ReviewAggregate;
}

/**
 * Body for `POST /products/:productId/reviews` (`CreateReviewDto`). `title` is
 * accepted by the API but NOT persisted (no `title` column).
 */
export interface CreateReviewInput {
  rating: number;
  title?: string;
  body?: string;
}

/** Body for `PATCH /admin/reviews/:id` (`UpdateReviewDto`). */
export interface UpdateReviewInput {
  status?: ReviewStatus;
  admin_reply?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Promotions — validation, promo codes, promo banners
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /promo/validate` (`ValidatePromoDto`). */
export interface ValidatePromoInput {
  code: string;
  subtotalKes?: number;
}

/** Response of `POST /promo/validate` (`PromoValidationResultDto`). */
export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discountType?: DiscountType;
  discountValue?: number;
  discountKes?: number;
  message: string;
}

/**
 * A `promo_codes` row. The admin list/create/update endpoints type these as
 * `unknown` in the API; this is the documented column shape.
 */
export interface PromoCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  value: number;
  category_id: string | null;
  max_uses: number | null;
  uses: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  [key: string]: unknown;
}

/** Body for `POST /admin/promo-codes` (`CreatePromoCodeDto`). */
export interface CreatePromoCodeInput {
  code: string;
  discount_type: DiscountType;
  value: number;
  category_id?: string;
  max_uses?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

/** Body for `PATCH /admin/promo-codes/:id` (`UpdatePromoCodeDto`). */
export type UpdatePromoCodeInput = Partial<CreatePromoCodeInput>;

/** A `promo_banners` row (typed as `unknown` in the API; documented shape). */
export interface PromoBanner {
  id: string;
  image_url: string;
  target_url: string | null;
  headline: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  [key: string]: unknown;
}

/** Body for `POST /admin/promo-banners` (`CreatePromoBannerDto`). */
export interface CreatePromoBannerInput {
  image_url: string;
  target_url?: string;
  headline?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
  sort_order?: number;
}

/** Body for `PATCH /admin/promo-banners/:id` (`UpdatePromoBannerDto`). */
export type UpdatePromoBannerInput = Partial<CreatePromoBannerInput>;

/** Response of the admin promo code / banner delete endpoints. */
export interface DeletionResult {
  id: string;
  deleted: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opening hours for a single weekday: `[open, close]` 24h `HH:MM`, or null when
 * closed (`BranchHoursDto`).
 */
export type BranchDayHours = [string, string] | null;

/** Opening hours keyed by short weekday name. */
export interface BranchHours {
  mon?: BranchDayHours;
  tue?: BranchDayHours;
  wed?: BranchDayHours;
  thu?: BranchDayHours;
  fri?: BranchDayHours;
  sat?: BranchDayHours;
  sun?: BranchDayHours;
}

/** A `branches` row (`BranchDto` / `BranchRow`). */
export interface Branch {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  hours: Record<string, unknown> | null;
  is_active: boolean;
  /** Max concurrent non-cancelled bookings per slot at this branch (SPEC-04 R6). */
  capacity: number;
  created_at: string;
}

/** Body for `POST /branches` (`CreateBranchDto`). */
export interface CreateBranchInput {
  slug: string;
  name: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  hours?: BranchHours;
  is_active?: boolean;
  capacity?: number;
}

/** Body for `PATCH /branches/:id` (`UpdateBranchDto`). */
export type UpdateBranchInput = Partial<CreateBranchInput>;

// ─────────────────────────────────────────────────────────────────────────────
// Account ("me")
// ─────────────────────────────────────────────────────────────────────────────

/** Response of the `me` endpoints (`MeProfileDto`). */
export interface MeProfile {
  /** Supabase `auth.users.id`. Stable identity. */
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  /** False when the response is a minimal token-only identity. */
  has_profile: boolean;
}

/** Body for `PATCH /me` (`UpdateMeDto`). */
export interface UpdateMeInput {
  full_name?: string;
  phone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /contact` (`ContactDto`). */
export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

/** Response of `POST /contact`. */
export interface ContactResult {
  ok: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin metrics — dashboard + analytics
// ─────────────────────────────────────────────────────────────────────────────

/** Rolling dashboard window (`DashboardRange`). */
export type DashboardRange = '7d' | '30d' | '90d';

/** Query for `GET /admin/dashboard` (`DashboardQueryDto`). */
export interface DashboardQuery {
  range?: DashboardRange;
}

/** A single high-level KPI tile (`DashboardKpis`). */
export interface DashboardKpis {
  totalRevenueKes: number;
  orderCount: number;
  customerCount: number;
  averageOrderValueKes: number;
}

/** A recent order row for the dashboard list (`RecentOrder`). */
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

/** A top-selling product aggregated from `order_items` (`TopProduct`). */
export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  units: number;
  revenueKes: number;
}

/** One point on the daily revenue time-series (`DailyRevenuePoint`). */
export interface DailyRevenuePoint {
  /** YYYY-MM-DD */
  date: string;
  revenueKes: number;
  orders: number;
}

/** Full `GET /admin/dashboard` payload (`DashboardResponse`). */
export interface DashboardResponse {
  range: string;
  from: string;
  to: string;
  kpis: DashboardKpis;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  dailyRevenue: DailyRevenuePoint[];
  /** Share of paid orders by payment rail (gap G-4). */
  paymentMethods: PaymentMethodBreakdown[];
  /** Calendar-scoped KPI figures, independent of `range`. */
  snapshot: DashboardSnapshot;
}

/**
 * Point-in-time figures that do not vary with the dashboard range
 * (`DashboardSnapshot`). The KPI cards read "Revenue (Month)", "Orders Today"
 * and "Appointments Today" — calendar questions the range-scoped `kpis` block
 * cannot answer.
 */
export interface DashboardSnapshot {
  revenueMonthKes: number;
  ordersToday: number;
  appointmentsToday: number;
}

/**
 * Share of paid orders by payment rail (`PaymentMethodBreakdown`).
 * `share` is a percentage of order COUNT, not revenue. Orders with no recorded
 * method appear as `unknown` so the shares always total 100.
 */
export interface PaymentMethodBreakdown {
  method: string;
  orders: number;
  revenueKes: number;
  share: number;
}

/** Query for `GET /admin/analytics` (`AnalyticsQueryDto`). */
export interface AnalyticsQuery {
  /** Inclusive start date (ISO-8601). Defaults to 30 days ago. */
  from?: string;
  /** Inclusive end date (ISO-8601). Defaults to now. */
  to?: string;
}

/** Sales summary block for the analytics report (`SalesSummary`). */
export interface SalesSummary {
  totalRevenueKes: number;
  orderCount: number;
  unitsSold: number;
  averageOrderValueKes: number;
}

/** One bucket of the order-volume-by-day series (`OrderVolumePoint`). */
export interface OrderVolumePoint {
  date: string;
  orders: number;
  revenueKes: number;
}

/** Revenue grouped by product category (`CategoryRevenue`). */
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

/** Full `GET /admin/analytics` payload (`AnalyticsResponse`). */
export interface AnalyticsResponse {
  from: string;
  to: string;
  summary: SalesSummary;
  topProducts: TopProduct[];
  orderVolumeByDay: OrderVolumePoint[];
  revenueByCategory: CategoryRevenue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin customers
// ─────────────────────────────────────────────────────────────────────────────

/** An order as embedded in the admin customer list (`CustomerOrderSummaryDto`). */
export interface CustomerOrderSummary {
  id: string;
  order_number: string;
  total_kes: number;
  status: string;
}

/** A `customers` row with orders embedded (`AdminCustomerDto`). */
export interface AdminCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  /** When an admin deactivated this account, or null if active. */
  deactivated_at: string | null;
  orders: CustomerOrderSummary[];
}

/** Body for `PATCH /admin/customers/:id` (`SetCustomerStatusDto`). */
export interface SetCustomerStatusInput {
  status: 'active' | 'deactivated';
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin inventory
// ─────────────────────────────────────────────────────────────────────────────

/** A branch column in the inventory grid (`InventoryBranchDto`). */
export interface InventoryBranch {
  id: string;
  name: string;
}

/** The product an inventory row belongs to (`InventoryProductDto`). */
export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category_name: string | null;
}

/** One `inventory` row: stock of a product at a branch (`InventoryItemDto`). */
export interface InventoryItem {
  product_id: string;
  branch_id: string;
  stock: number;
  product: InventoryProduct;
}

/** `GET /admin/inventory` payload (`InventoryResponseDto`). */
export interface InventoryResponse {
  branches: InventoryBranch[];
  items: InventoryItem[];
}

/** The stock row returned by `PATCH /admin/inventory`. */
export interface InventoryStock {
  product_id: string;
  branch_id: string;
  stock: number;
}

/** Body for `PATCH /admin/inventory` (`UpdateStockDto`). */
export interface SetStockInput {
  product_id: string;
  branch_id: string;
  stock: number;
}

// ── Order cancellation (SPEC-06) ────────────────────────────────────────────

/** A customer's request to cancel an order, as the admin panel sees it. */
export interface AdminCancellationRequest {
  id: string;
  order_id: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'declined';
  status_at_request: string;
  decline_reason: string | null;
  decided_at: string | null;
  created_at: string;
  orderNumber: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  totalKes: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** The order moved to a later stage while the request sat pending. */
  movedSinceRequest: boolean;
}

/** Eligibility + any open request, for a customer's own order. */
export interface CancellationStatus {
  orderId: string;
  canRequest: boolean;
  ineligibleReason: string | null;
  windowHours: number;
  request: {
    id: string;
    status: 'pending' | 'approved' | 'declined';
    reason: string | null;
    decline_reason: string | null;
    created_at: string;
    decided_at: string | null;
  } | null;
}

/** Money the system deliberately does not act on — SPEC-06 R5 and R7. */
export interface PaymentsNeedingAttention {
  /** Paid, then cancelled. No automatic refund: someone must decide. */
  paidAndCancelled: {
    orderId: string;
    orderNumber: string;
    totalKes: number;
    paymentMethod: string | null;
    updatedAt: string | null;
  }[];
  /** Provider-reversed transactions. Recorded, never acted on automatically. */
  reversed: {
    id: string;
    provider: 'mpesa' | 'pesapal';
    reference: string | null;
    amountKes: number | null;
    orderId: string | null;
    orderNumber: string | null;
    receivedAt: string;
  }[];
}
