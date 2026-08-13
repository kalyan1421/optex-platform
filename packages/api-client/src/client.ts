/**
 * The OPTEX API client factory.
 *
 * `createApiClient` returns a strongly-typed client whose namespaced method
 * groups (catalog, cart, orders, payments, …) each map to a real route on the
 * NestJS API. The API mounts every route under the global `/api` prefix
 * (`apps/api/src/main.ts`), so callers pass `baseUrl` as the origin (e.g.
 * `https://api.optex.co.ke`) and this client appends `/api/...` itself.
 *
 * Auth: every request awaits `getAccessToken()` and, when it yields a token,
 * attaches it as `Authorization: Bearer <token>`. Public routes simply work
 * without a token. Errors are normalized into `ApiError` from the API's error
 * envelope (`apps/api/src/common/all-exceptions.filter.ts`).
 *
 * Runtime: relies only on the global `fetch`, `FormData`, and `URLSearchParams`
 * (Next.js 14 / Node 18+ / modern browsers) — no runtime dependencies.
 */

import type {
  AddCartItemInput,
  AdminAppointmentQuery,
  AdminCustomer,
  AdminReview,
  InventoryResponse,
  InventoryStock,
  SetStockInput,
  AuthResult,
  AuthUser,
  LoginInput,
  RefreshInput,
  SignupInput,
  AdminListOrdersQuery,
  AdminListPaymentsQuery,
  AdminOrderStatusInput,
  AdminOrderSummary,
  AdminPayment,
  AnalyticsQuery,
  AnalyticsResponse,
  ApiErrorBody,
  Appointment,
  ApplyPromoInput,
  Branch,
  Cart,
  Category,
  CheckoutInput,
  CheckoutResult,
  ContactInput,
  ContactResult,
  CreateAppointmentInput,
  CreateBranchInput,
  CreateProductInput,
  CreatePromoBannerInput,
  CreatePromoCodeInput,
  CreateReviewInput,
  DashboardQuery,
  DashboardResponse,
  DeletionResult,
  ListOrdersQuery,
  MeProfile,
  MpesaQueryInput,
  MpesaStatus,
  MpesaStkPushInput,
  MpesaStkPushResult,
  OrderDetail,
  OrderSummary,
  OrderTracking,
  Paginated,
  PaginatedOrders,
  PaginatedPayments,
  PesapalInitiateInput,
  PesapalInitiateResult,
  PesapalStatus,
  PesapalStatusQuery,
  Prescription,
  PrescriptionQuery,
  Product,
  ProductDeactivationResult,
  ProductImageUploadResult,
  ProductQuery,
  ProductReviews,
  ProductSearchQuery,
  PromoBanner,
  PromoCode,
  PromoValidationResult,
  LinkPaymentInput,
  ReconcilePaymentInput,
  ReconcileResult,
  RescheduleAppointmentInput,
  Review,
  AdminAppointment,
  SignedDownloadUrl,
  UpdatePrescriptionStatusInput,
  Slots,
  SlotsQuery,
  UpdateAppointmentInput,
  UpdateBranchInput,
  UpdateCartItemInput,
  UpdateMeInput,
  UpdateProductInput,
  UpdatePromoBannerInput,
  UpdatePromoCodeInput,
  UpdateReviewInput,
  UploadPrescriptionFields,
  ValidatePromoInput,
  AdminCancellationRequest,
  CancellationStatus,
  PaymentsNeedingAttention,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown on any non-2xx API response. Carries the normalized fields from the
 * API error envelope so callers can branch on `status` / `code` and surface
 * `message` to the user. `requestId` is handy for correlating with API logs.
 */
export class ApiError extends Error {
  /** HTTP status code (e.g. 401, 404, 422, 500). */
  readonly status: number;
  /** Machine code from the envelope (e.g. `NOT_FOUND`, `UNAUTHORIZED`). */
  readonly code: string;
  /** Request correlation id, when the API supplied one. */
  readonly requestId?: string;
  /** The full parsed error body, when the response was JSON. */
  readonly body?: ApiErrorBody;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    body?: ApiErrorBody;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.body = args.body;
    // Restore the prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory options + internals
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves to a token (sync or async), or nothing for anonymous calls. */
export type GetAccessToken = () => string | null | undefined | Promise<string | null | undefined>;

export interface CreateApiClientOptions {
  /**
   * API origin WITHOUT the `/api` prefix, e.g. `https://api.optex.co.ke` or
   * `http://localhost:1111`. A trailing slash is tolerated. The `/api` prefix
   * is appended by the client.
   */
  baseUrl: string;
  /**
   * Supplies the Supabase access token to attach as a Bearer token. Awaited on
   * every request. Return `null`/`undefined` (or omit the option entirely) for
   * public, unauthenticated calls.
   */
  getAccessToken?: GetAccessToken;
  /**
   * Optional `fetch` override (e.g. to inject Next.js caching options or a
   * custom agent in tests). Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
  /** Optional default headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

/** Query value types accepted by the param serializer. */
type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serialized as the request body (skipped when `form` is set). */
  body?: unknown;
  /** Multipart body for uploads. When set, no JSON content-type is added. */
  form?: FormData;
  /** Query params; `undefined`/`null` entries are dropped. */
  query?: QueryParams;
  /** Per-request fetch options passthrough (e.g. `signal`, Next `cache`). */
  init?: RequestInit;
}

/** Serialize a query object into a `?a=1&b=2` string (empty when no params). */
function serializeQuery(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Extract a normalized `ApiError` from a non-2xx response. */
async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  let message = response.statusText || `Request failed (${response.status})`;
  let code = `HTTP_${response.status}`;

  try {
    const parsed = (await response.json()) as Partial<ApiErrorBody>;
    if (parsed && typeof parsed === 'object') {
      body = parsed as ApiErrorBody;
      if (typeof parsed.code === 'string') code = parsed.code;
      if (parsed.message !== undefined) {
        message = Array.isArray(parsed.message)
          ? parsed.message.join(', ')
          : String(parsed.message);
      } else if (typeof parsed.error === 'string') {
        message = parsed.error;
      }
    }
  } catch {
    // Non-JSON error body (e.g. a proxy 502). Fall back to status text.
  }

  return new ApiError({
    status: response.status,
    code,
    message,
    requestId: body?.requestId,
    body,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiClient {
  /** Low-level request helper, exposed for routes not yet wrapped above. */
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
  auth: AuthApi;
  catalog: CatalogApi;
  cart: CartApi;
  orders: OrdersApi;
  payments: PaymentsApi;
  appointments: AppointmentsApi;
  prescriptions: PrescriptionsApi;
  reviews: ReviewsApi;
  promotions: PromotionsApi;
  branches: BranchesApi;
  account: AccountApi;
  contact: ContactApi;
  admin: AdminApi;
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  const { getAccessToken, defaultHeaders } = options;
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error(
      '@optex/api-client: no global fetch available. Pass `fetch` in options or run on Node 18+/a modern browser.',
    );
  }

  // M-6 FIX: validate baseUrl is a real URL before using it to prevent XSS via
  // javascript: or data: URIs being used as a request origin.
  let parsedBase: URL;
  try {
    parsedBase = new URL(options.baseUrl);
  } catch {
    throw new Error(
      `@optex/api-client: baseUrl must be a valid URL, got: ${JSON.stringify(options.baseUrl)}`,
    );
  }
  if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
    throw new Error(
      `@optex/api-client: baseUrl must use http or https, got: ${parsedBase.protocol}`,
    );
  }
  const origin = options.baseUrl.replace(/\/+$/, '');
  const apiBase = `${origin}/api`;

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, form, query, init } = opts;

    const headers = new Headers(defaultHeaders);
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    }
    headers.set('Accept', 'application/json');

    // Attach the bearer token when one is available.
    if (getAccessToken) {
      const token = await getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    // Body handling: FormData uploads must NOT set a JSON content-type — the
    // runtime sets the multipart boundary itself.
    let payload: BodyInit | undefined;
    if (form !== undefined) {
      payload = form;
    } else if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }

    const url = `${apiBase}${path}${serializeQuery(query)}`;
    const response = await doFetch(url, {
      ...init,
      method,
      headers,
      body: payload,
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    // 204 No Content (e.g. DELETE /branches/:id) — nothing to parse.
    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ── auth ─────────────────────────────────────────────────────────────────
  const auth: AuthApi = {
    login: (input) => request<AuthResult>('/auth/login', { method: 'POST', body: input }),
    signup: (input) => request<AuthResult>('/auth/signup', { method: 'POST', body: input }),
    refresh: (input) => request<AuthResult>('/auth/refresh', { method: 'POST', body: input }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<AuthUser>('/auth/me'),
  };

  // ── catalog ────────────────────────────────────────────────────────────────
  const catalog: CatalogApi = {
    listProducts: (query) =>
      request<Paginated<Product>>('/products', { query: query as QueryParams }),
    searchProducts: (query) =>
      request<Paginated<Product>>('/products/search', {
        query: query as unknown as QueryParams,
      }),
    getProduct: (slug) => request<Product>(`/products/${encodeURIComponent(slug)}`),
    getRelatedProducts: (id) => request<Product[]>(`/products/${encodeURIComponent(id)}/related`),
    listCategories: () => request<Category[]>('/categories'),
  };

  // ── cart ─────────────────────────────────────────────────────────────────
  const cart: CartApi = {
    get: () => request<Cart>('/cart'),
    addItem: (input) => request<Cart>('/cart/items', { method: 'POST', body: input }),
    updateItem: (itemId, input) =>
      request<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: input,
      }),
    removeItem: (itemId) =>
      request<Cart>(`/cart/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      }),
    applyPromo: (input) => request<Cart>('/cart/apply-promo', { method: 'POST', body: input }),
    clearPromo: () => request<Cart>('/cart/promo', { method: 'DELETE' }),
  };

  // ── orders ───────────────────────────────────────────────────────────────
  const orders: OrdersApi = {
    checkout: (input) => request<CheckoutResult>('/checkout', { method: 'POST', body: input }),
    list: (query) =>
      request<PaginatedOrders<OrderSummary>>('/orders', {
        query: query as QueryParams,
      }),
    get: (id) => request<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
    tracking: (id) => request<OrderTracking>(`/orders/${encodeURIComponent(id)}/tracking`),
    cancellationStatus: (id) =>
      request<CancellationStatus>(`/orders/${encodeURIComponent(id)}/cancellation`),
    requestCancellation: (id, reason) =>
      request<{ id: string; status: string; createdAt: string; message: string }>(
        `/orders/${encodeURIComponent(id)}/cancellation`,
        { method: 'POST', body: { reason } },
      ),
  };

  // ── payments ───────────────────────────────────────────────────────────────
  const payments: PaymentsApi = {
    mpesaStkPush: (input) =>
      request<MpesaStkPushResult>('/payments/mpesa/stk-push', {
        method: 'POST',
        body: input,
      }),
    mpesaQuery: (input) =>
      request<MpesaStatus>('/payments/mpesa/query', {
        method: 'POST',
        body: input,
      }),
    pesapalInitiate: (input) =>
      request<PesapalInitiateResult>('/payments/pesapal/initiate', {
        method: 'POST',
        body: input,
      }),
    pesapalStatus: (query) =>
      request<PesapalStatus>('/payments/pesapal/status', {
        query: query as unknown as QueryParams,
      }),
  };

  // ── appointments ─────────────────────────────────────────────────────────
  const appointments: AppointmentsApi = {
    slots: (query) =>
      request<Slots>('/appointments/slots', {
        query: query as unknown as QueryParams,
      }),
    create: (input) => request<Appointment>('/appointments', { method: 'POST', body: input }),
    listMine: () => request<Appointment[]>('/appointments'),
    cancel: (id) =>
      request<Appointment>(`/appointments/${encodeURIComponent(id)}/cancel`, {
        method: 'PATCH',
      }),
    reschedule: (id, input) =>
      request<Appointment>(`/appointments/${encodeURIComponent(id)}/reschedule`, {
        method: 'PATCH',
        body: input,
      }),
  };

  // ── prescriptions ──────────────────────────────────────────────────────────
  const prescriptions: PrescriptionsApi = {
    upload: (file, fields) => {
      const form = new FormData();
      form.append('file', file);
      if (fields) {
        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null) {
            form.append(key, String(value));
          }
        }
      }
      return request<Prescription>('/prescriptions/upload', {
        method: 'POST',
        form,
      });
    },
    listMine: () => request<Prescription[]>('/prescriptions'),
    download: (id) =>
      request<SignedDownloadUrl>(`/prescriptions/${encodeURIComponent(id)}/download`),
  };

  // ── reviews ──────────────────────────────────────────────────────────────
  const reviews: ReviewsApi = {
    listForProduct: (productId) =>
      request<ProductReviews>(`/products/${encodeURIComponent(productId)}/reviews`),
    create: (productId, input) =>
      request<Review>(`/products/${encodeURIComponent(productId)}/reviews`, {
        method: 'POST',
        body: input,
      }),
  };

  // ── promotions ─────────────────────────────────────────────────────────────
  const promotions: PromotionsApi = {
    validate: (input) =>
      request<PromoValidationResult>('/promo/validate', {
        method: 'POST',
        body: input,
      }),
  };

  // ── branches ───────────────────────────────────────────────────────────────
  const branches: BranchesApi = {
    list: (q) => request<Branch[]>('/branches', { query: q ? { q } : undefined }),
    get: (id) => request<Branch>(`/branches/${encodeURIComponent(id)}`),
  };

  // ── account ──────────────────────────────────────────────────────────────
  const account: AccountApi = {
    me: () => request<MeProfile>('/me'),
    updateMe: (input) => request<MeProfile>('/me', { method: 'PATCH', body: input }),
  };

  // ── contact ──────────────────────────────────────────────────────────────
  const contact: ContactApi = {
    submit: (input) => request<ContactResult>('/contact', { method: 'POST', body: input }),
  };

  // ── admin ──────────────────────────────────────────────────────────────────
  const admin: AdminApi = {
    orders: {
      list: (query) =>
        request<PaginatedOrders<AdminOrderSummary>>('/admin/orders', {
          query: query as QueryParams,
        }),
      get: (id) => request<OrderDetail>(`/admin/orders/${encodeURIComponent(id)}`),
      updateStatus: (id, input) =>
        request<OrderDetail>(`/admin/orders/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: input,
        }),
    },
    cancellations: {
      list: (status) =>
        request<AdminCancellationRequest[]>('/admin/cancellations', {
          query: status ? { status } : undefined,
        }),
      pendingCount: () => request<{ count: number }>('/admin/cancellations/pending-count'),
      approve: (id, acknowledgePaid = false) =>
        request<{ id: string; status: string; orderStatus: string }>(
          `/admin/cancellations/${encodeURIComponent(id)}/approve`,
          { method: 'PATCH', body: { acknowledgePaid } },
        ),
      decline: (id, reason) =>
        request<{ id: string; status: string }>(
          `/admin/cancellations/${encodeURIComponent(id)}/decline`,
          { method: 'PATCH', body: { reason } },
        ),
    },
    payments: {
      needingAttention: () => request<PaymentsNeedingAttention>('/admin/payments/attention'),
      list: (query) =>
        request<PaginatedPayments<AdminPayment>>('/admin/payments', {
          query: query as QueryParams,
        }),
      reconcile: (id, input) =>
        request<ReconcileResult>(`/admin/payments/${encodeURIComponent(id)}/reconcile`, {
          method: 'POST',
          body: input,
        }),
      link: (id, input) =>
        request<ReconcileResult>(`/admin/payments/${encodeURIComponent(id)}/link`, {
          method: 'POST',
          body: input,
        }),
    },
    // Admin product writes live on the catalog controller (gated by
    // @Roles('super_admin')) — there is no `/admin/products` route.
    products: {
      listAll: (query) =>
        request<Paginated<Product>>('/products/admin/all', {
          query: query as QueryParams | undefined,
        }),
      create: (input) => request<Product>('/products', { method: 'POST', body: input }),
      update: (id, input) =>
        request<Product>(`/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
      remove: (id) =>
        request<ProductDeactivationResult>(`/products/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      uploadImage: (id, file) => {
        const form = new FormData();
        form.append('file', file);
        return request<ProductImageUploadResult>(`/products/${encodeURIComponent(id)}/images`, {
          method: 'POST',
          form,
        });
      },
    },
    promos: {
      list: () => request<PromoCode[]>('/admin/promo-codes'),
      create: (input) => request<PromoCode>('/admin/promo-codes', { method: 'POST', body: input }),
      update: (id, input) =>
        request<PromoCode>(`/admin/promo-codes/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
      remove: (id) =>
        request<DeletionResult>(`/admin/promo-codes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
    },
    banners: {
      list: () => request<PromoBanner[]>('/admin/promo-banners'),
      create: (input) =>
        request<PromoBanner>('/admin/promo-banners', {
          method: 'POST',
          body: input,
        }),
      update: (id, input) =>
        request<PromoBanner>(`/admin/promo-banners/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
      remove: (id) =>
        request<DeletionResult>(`/admin/promo-banners/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
    },
    branches: {
      listAll: (q) => request<Branch[]>('/branches/admin/all', { query: q ? { q } : undefined }),
      create: (input) => request<Branch>('/branches', { method: 'POST', body: input }),
      update: (id, input) =>
        request<Branch>(`/branches/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
      remove: (id) =>
        request<void>(`/branches/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
    },
    reviews: {
      list: (status) =>
        request<AdminReview[]>('/admin/reviews', {
          query: status ? { status } : undefined,
        }),
      moderate: (id, input) =>
        request<Review>(`/admin/reviews/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
    },
    appointments: {
      list: (query) =>
        request<AdminAppointment[]>('/admin/appointments', {
          query: query as QueryParams,
        }),
      update: (id, input) =>
        request<Appointment>(`/admin/appointments/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
    },
    prescriptions: {
      list: (query) =>
        request<Prescription[]>('/admin/prescriptions', {
          query: query as QueryParams | undefined,
        }),
      download: (id) =>
        request<SignedDownloadUrl>(`/admin/prescriptions/${encodeURIComponent(id)}/download`),
      updateStatus: (id, input) =>
        request<Prescription>(`/admin/prescriptions/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: input,
        }),
    },
    customers: {
      list: (search) =>
        request<AdminCustomer[]>('/admin/customers', {
          query: search ? { search } : undefined,
        }),
    },
    inventory: {
      list: () => request<InventoryResponse>('/admin/inventory'),
      setStock: (input) =>
        request<InventoryStock>('/admin/inventory', {
          method: 'PATCH',
          body: input,
        }),
    },
    dashboard: (query) =>
      request<DashboardResponse>('/admin/dashboard', {
        query: query as QueryParams | undefined,
      }),
    analytics: (query) =>
      request<AnalyticsResponse>('/admin/analytics', {
        query: query as QueryParams | undefined,
      }),
  };

  return {
    request,
    auth,
    catalog,
    cart,
    orders,
    payments,
    appointments,
    prescriptions,
    reviews,
    promotions,
    branches,
    account,
    contact,
    admin,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Method-group interfaces (the client's public surface)
// ─────────────────────────────────────────────────────────────────────────────

/** API-proxied auth (`/auth/*`) — no direct Supabase calls from the frontend. */
export interface AuthApi {
  /** `POST /auth/login` */
  login: (input: LoginInput) => Promise<AuthResult>;
  /** `POST /auth/signup` */
  signup: (input: SignupInput) => Promise<AuthResult>;
  /** `POST /auth/refresh` */
  refresh: (input: RefreshInput) => Promise<AuthResult>;
  /** `POST /auth/logout` (requires a bearer token) */
  logout: () => Promise<void>;
  /** `GET /auth/me` (requires a bearer token) */
  me: () => Promise<AuthUser>;
}

/** Public catalog reads (`/products`, `/categories`). */
export interface CatalogApi {
  /** `GET /products` */
  listProducts: (query?: ProductQuery) => Promise<Paginated<Product>>;
  /** `GET /products/search` */
  searchProducts: (query: ProductSearchQuery) => Promise<Paginated<Product>>;
  /** `GET /products/:slug` */
  getProduct: (slug: string) => Promise<Product>;
  /** `GET /products/:id/related` */
  getRelatedProducts: (id: string) => Promise<Product[]>;
  /** `GET /categories` */
  listCategories: () => Promise<Category[]>;
}

/** Authenticated server-side cart (`/cart`). */
export interface CartApi {
  /** `GET /cart` */
  get: () => Promise<Cart>;
  /** `POST /cart/items` */
  addItem: (input: AddCartItemInput) => Promise<Cart>;
  /** `PATCH /cart/items/:id` */
  updateItem: (itemId: string, input: UpdateCartItemInput) => Promise<Cart>;
  /** `DELETE /cart/items/:id` */
  removeItem: (itemId: string) => Promise<Cart>;
  /** `POST /cart/apply-promo` */
  applyPromo: (input: ApplyPromoInput) => Promise<Cart>;
  /** `DELETE /cart/promo` */
  clearPromo: () => Promise<Cart>;
}

/** Authenticated checkout + order history (`/checkout`, `/orders`). */
export interface OrdersApi {
  /** `POST /checkout` */
  checkout: (input: CheckoutInput) => Promise<CheckoutResult>;
  /** `GET /orders` */
  list: (query?: ListOrdersQuery) => Promise<PaginatedOrders<OrderSummary>>;
  /** `GET /orders/:id` */
  get: (id: string) => Promise<OrderDetail>;
  /** `GET /orders/:id/tracking` */
  tracking: (id: string) => Promise<OrderTracking>;
  /** `GET /orders/:id/cancellation` — eligibility plus any open request. */
  cancellationStatus: (id: string) => Promise<CancellationStatus>;
  /** `POST /orders/:id/cancellation` — asks; does not cancel. */
  requestCancellation: (
    id: string,
    reason?: string,
  ) => Promise<{ id: string; status: string; createdAt: string; message: string }>;
}

/** Authenticated payment rails (`/payments/...`). */
export interface PaymentsApi {
  /** `POST /payments/mpesa/stk-push` */
  mpesaStkPush: (input: MpesaStkPushInput) => Promise<MpesaStkPushResult>;
  /** `POST /payments/mpesa/query` */
  mpesaQuery: (input: MpesaQueryInput) => Promise<MpesaStatus>;
  /** `POST /payments/pesapal/initiate` */
  pesapalInitiate: (input: PesapalInitiateInput) => Promise<PesapalInitiateResult>;
  /** `GET /payments/pesapal/status` */
  pesapalStatus: (query: PesapalStatusQuery) => Promise<PesapalStatus>;
}

/** Appointment booking (`/appointments/...`). `slots` is public. */
export interface AppointmentsApi {
  /** `GET /appointments/slots` (public) */
  slots: (query: SlotsQuery) => Promise<Slots>;
  /** `POST /appointments` */
  create: (input: CreateAppointmentInput) => Promise<Appointment>;
  /** `GET /appointments` */
  listMine: () => Promise<Appointment[]>;
  /** `PATCH /appointments/:id/cancel` */
  cancel: (id: string) => Promise<Appointment>;
  /** `PATCH /appointments/:id/reschedule` */
  reschedule: (id: string, input: RescheduleAppointmentInput) => Promise<Appointment>;
}

/** Customer prescriptions (`/prescriptions/...`). */
export interface PrescriptionsApi {
  /**
   * `POST /prescriptions/upload` — multipart. Pass the file as a `Blob`/`File`;
   * optional measurement fields are appended as form fields.
   */
  upload: (file: Blob, fields?: UploadPrescriptionFields) => Promise<Prescription>;
  /** `GET /prescriptions` */
  listMine: () => Promise<Prescription[]>;
  /** `GET /prescriptions/:id/download` */
  download: (id: string) => Promise<SignedDownloadUrl>;
}

/** Product reviews (`/products/:productId/reviews`). `list` is public. */
export interface ReviewsApi {
  /** `GET /products/:productId/reviews` (public) */
  listForProduct: (productId: string) => Promise<ProductReviews>;
  /** `POST /products/:productId/reviews` */
  create: (productId: string, input: CreateReviewInput) => Promise<Review>;
}

/** Customer promo validation (`/promo/validate`). */
export interface PromotionsApi {
  /** `POST /promo/validate` */
  validate: (input: ValidatePromoInput) => Promise<PromoValidationResult>;
}

/** Public branch directory (`/branches`). */
export interface BranchesApi {
  /** `GET /branches?q=` (public) */
  list: (q?: string) => Promise<Branch[]>;
  /** `GET /branches/:id` (public) */
  get: (id: string) => Promise<Branch>;
}

/** Authenticated self-service profile (`/me`). */
export interface AccountApi {
  /** `GET /me` */
  me: () => Promise<MeProfile>;
  /** `PATCH /me` */
  updateMe: (input: UpdateMeInput) => Promise<MeProfile>;
}

/** Public contact form (`/contact`). */
export interface ContactApi {
  /** `POST /contact` (public) */
  submit: (input: ContactInput) => Promise<ContactResult>;
}

/** Super-admin surface — every route is gated by `@Roles('super_admin')`. */
export interface AdminApi {
  orders: {
    /** `GET /admin/orders` */
    list: (query?: AdminListOrdersQuery) => Promise<PaginatedOrders<AdminOrderSummary>>;
    /** `GET /admin/orders/:id` */
    get: (id: string) => Promise<OrderDetail>;
    /** `PATCH /admin/orders/:id/status` */
    updateStatus: (id: string, input: AdminOrderStatusInput) => Promise<OrderDetail>;
  };
  /** Customer cancellation requests — SPEC-06 R3. */
  cancellations: {
    /** `GET /admin/cancellations` */
    list: (status?: string) => Promise<AdminCancellationRequest[]>;
    /** `GET /admin/cancellations/pending-count` */
    pendingCount: () => Promise<{ count: number }>;
    /** `PATCH /admin/cancellations/:id/approve` — cancels the order. */
    approve: (
      id: string,
      acknowledgePaid?: boolean,
    ) => Promise<{ id: string; status: string; orderStatus: string }>;
    /** `PATCH /admin/cancellations/:id/decline` — the order keeps its status. */
    decline: (id: string, reason?: string) => Promise<{ id: string; status: string }>;
  };
  payments: {
    /** `GET /admin/payments/attention` — paid-and-cancelled orders, and reversals. */
    needingAttention: () => Promise<PaymentsNeedingAttention>;
    /** `GET /admin/payments` */
    list: (query?: AdminListPaymentsQuery) => Promise<PaginatedPayments<AdminPayment>>;
    /** `POST /admin/payments/:id/reconcile` */
    reconcile: (id: string, input: ReconcilePaymentInput) => Promise<ReconcileResult>;
    /** `POST /admin/payments/:id/link` */
    link: (id: string, input: LinkPaymentInput) => Promise<ReconcileResult>;
  };
  products: {
    /** `GET /products/admin/all` — includes inactive products (gap G-2) */
    listAll: (query?: ProductQuery) => Promise<Paginated<Product>>;
    /** `POST /products` */
    create: (input: CreateProductInput) => Promise<Product>;
    /** `PATCH /products/:id` */
    update: (id: string, input: UpdateProductInput) => Promise<Product>;
    /** `DELETE /products/:id` (soft-delete) */
    remove: (id: string) => Promise<ProductDeactivationResult>;
    /** `POST /products/:id/images` — multipart */
    uploadImage: (id: string, file: Blob) => Promise<ProductImageUploadResult>;
  };
  promos: {
    /** `GET /admin/promo-codes` */
    list: () => Promise<PromoCode[]>;
    /** `POST /admin/promo-codes` */
    create: (input: CreatePromoCodeInput) => Promise<PromoCode>;
    /** `PATCH /admin/promo-codes/:id` */
    update: (id: string, input: UpdatePromoCodeInput) => Promise<PromoCode>;
    /** `DELETE /admin/promo-codes/:id` */
    remove: (id: string) => Promise<DeletionResult>;
  };
  banners: {
    /** `GET /admin/promo-banners` */
    list: () => Promise<PromoBanner[]>;
    /** `POST /admin/promo-banners` */
    create: (input: CreatePromoBannerInput) => Promise<PromoBanner>;
    /** `PATCH /admin/promo-banners/:id` */
    update: (id: string, input: UpdatePromoBannerInput) => Promise<PromoBanner>;
    /** `DELETE /admin/promo-banners/:id` */
    remove: (id: string) => Promise<DeletionResult>;
  };
  branches: {
    /** `GET /branches/admin/all` — includes inactive branches (gap G-3) */
    listAll: (q?: string) => Promise<Branch[]>;
    /** `POST /branches` */
    create: (input: CreateBranchInput) => Promise<Branch>;
    /** `PATCH /branches/:id` */
    update: (id: string, input: UpdateBranchInput) => Promise<Branch>;
    /** `DELETE /branches/:id` (204 No Content) */
    remove: (id: string) => Promise<void>;
  };
  reviews: {
    /** `GET /admin/reviews?status=` */
    list: (status?: Review['status']) => Promise<AdminReview[]>;
    /** `PATCH /admin/reviews/:id` */
    moderate: (id: string, input: UpdateReviewInput) => Promise<Review>;
  };
  appointments: {
    /** `GET /admin/appointments` — includes resolved customer/branch names */
    list: (query?: AdminAppointmentQuery) => Promise<AdminAppointment[]>;
    /** `PATCH /admin/appointments/:id` */
    update: (id: string, input: UpdateAppointmentInput) => Promise<Appointment>;
  };
  prescriptions: {
    /** `GET /admin/prescriptions?customerId=` */
    list: (query?: PrescriptionQuery) => Promise<Prescription[]>;
    /** `GET /admin/prescriptions/:id/download` */
    download: (id: string) => Promise<SignedDownloadUrl>;
    /** `PATCH /admin/prescriptions/:id` */
    updateStatus: (id: string, input: UpdatePrescriptionStatusInput) => Promise<Prescription>;
  };
  customers: {
    /** `GET /admin/customers?search=` */
    list: (search?: string) => Promise<AdminCustomer[]>;
  };
  inventory: {
    /** `GET /admin/inventory` */
    list: () => Promise<InventoryResponse>;
    /** `PATCH /admin/inventory` */
    setStock: (input: SetStockInput) => Promise<InventoryStock>;
  };
  /** `GET /admin/dashboard` */
  dashboard: (query?: DashboardQuery) => Promise<DashboardResponse>;
  /** `GET /admin/analytics` */
  analytics: (query?: AnalyticsQuery) => Promise<AnalyticsResponse>;
}
