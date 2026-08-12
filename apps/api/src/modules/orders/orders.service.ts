import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';
import { CheckoutDeliveryOption, CheckoutDto, CheckoutPaymentMethod } from './dto/checkout.dto';
import { OrderStatus } from './dto/admin-list-orders-query.dto';
import { AdminOrderStatusDto } from './dto/admin-order-status.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { AdminListOrdersQueryDto } from './dto/admin-list-orders-query.dto';
import {
  AdminOrderSummaryView,
  CheckoutResultView,
  OrderDetailView,
  OrderItemView,
  OrderSummaryView,
  OrderTrackingView,
  PaginatedOrders,
  PaymentInstruction,
  TrackingStageView,
} from './dto/order-views';

/**
 * Money math (VAT 16% on the post-discount base, flat 300 KES delivery / free
 * pickup) now lives in the `place_order` Postgres RPC (migration 0008), which is
 * the single server-authoritative source for checkout amounts.
 *
 * Legal forward transitions for the admin status workflow. Keyed by current
 * status → set of allowed next statuses. `cancelled` and `delivered` are
 * terminal. This prevents nonsensical moves (e.g. delivered → pending_payment).
 */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.RECEIVED,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.RECEIVED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
  [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Ordered fulfilment stages for the tracking timeline (excludes cancelled). */
const TRACKING_STAGES: { key: TrackingStageView['key']; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'processing', label: 'Processing' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

/** Maps an `order_status` value to its position in the tracking timeline. */
const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  // pending_payment sits "before" Received in the timeline (index -1 → nothing lit)
  pending_payment: -1,
  received: 0,
  processing: 1,
  dispatched: 2,
  delivered: 3,
};

/** Round a KES amount to 2 decimals. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Checkout + order-history + admin order management for the storefront.
 *
 * Uses the privileged service-role Supabase client (`this.supabase.client`,
 * RLS-bypassing), so ownership is enforced IN CODE: every customer-facing read
 * and write is scoped through the caller's `customers.id`, resolved from the
 * JWT's `auth_user_id`.
 *
 * ATOMICITY NOTE: the Supabase JS client cannot run a multi-statement DB
 * transaction, and no `place_order` Postgres RPC exists in migrations 0001-0007.
 * `checkout()` therefore performs a best-effort sequence WITH COMPENSATION (it
 * deletes the just-created order if the `order_items` insert fails) so we never
 * leave an empty order behind. A Postgres `place_order(...)` function that wraps
 * the order insert + items insert + cart clear in a single transaction is a
 * RECOMMENDED FOLLOW-UP for true atomicity.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  // ─── Checkout ──────────────────────────────────────────────────────────────

  /**
   * Place an order from the caller's current cart via the atomic `place_order`
   * Postgres RPC (migration 0008).
   *
   * The RPC runs the entire checkout in ONE transaction: it recomputes every
   * amount server-side from live product prices (subtotal, promo validation +
   * discount, 16% VAT on the post-discount base, flat shipping), inserts the
   * order + order_items, bumps promo usage atomically, and clears the cart —
   * all-or-nothing. This replaces the previous best-effort insert/compensation
   * sequence (which could orphan an order or lose a promo-usage update under
   * concurrency) and keeps every figure server-authoritative (S-1 fix): the
   * client supplies only the payment method, shipping address, delivery option,
   * and an optional promo code.
   */
  async checkout(authUserId: string, dto: CheckoutDto): Promise<CheckoutResultView> {
    // Cash on delivery was withdrawn by the client (CLIENT-ANSWERS E6). It is
    // already absent from CheckoutPaymentMethod, so @IsEnum rejects it before
    // we get here — this is the server-side backstop the client asked for, and
    // it matters because `place_order` still accepts 'cod' at the database
    // level (the Postgres enum keeps it for historical rows). Without this,
    // any future caller that reaches the service directly could still create
    // an unpaid, immediately-fulfillable order.
    if ((dto.paymentMethod as string) === 'cod') {
      throw new BadRequestException(
        'Cash on delivery is no longer offered. Please pay with M-Pesa or card.',
      );
    }

    const customer = await this.resolveCustomer(authUserId);

    const deliveryOption = dto.deliveryOption ?? CheckoutDeliveryOption.DELIVERY;
    const shipping = {
      name: dto.shippingAddress.name,
      phone: dto.shippingAddress.phone,
      address: dto.shippingAddress.address,
      city: dto.shippingAddress.city,
      county: dto.shippingAddress.county,
      postal: dto.shippingAddress.postal ?? null,
      deliveryOption,
    };

    const promoCode = dto.promoCode?.trim() ? dto.promoCode.trim() : null;

    // Atomic checkout. place_order RAISEs readable, user-facing messages for
    // validation failures (empty cart, unavailable items, invalid/expired/
    // capped promo); surface them to the caller as 400s.
    const { data: placed, error } = await this.supabase.client.rpc('place_order', {
      p_customer_id: customer.id,
      p_payment_method: dto.paymentMethod,
      p_shipping: shipping,
      p_delivery_option: deliveryOption,
      p_promo_code: promoCode,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }

    // place_order RETURNS a single `orders` row; the JS client may surface it as
    // the object or a one-element array depending on typing — handle both.
    const placedRow = (Array.isArray(placed) ? placed[0] : placed) as { id: string } | null;
    if (!placedRow?.id) {
      throw new InternalServerErrorException('Checkout did not return an order.');
    }
    const orderId = placedRow.id;

    // Re-read the full detail for a consistent response shape (also enforces
    // ownership, though we just created it).
    const detail = await this.getOrderDetail(authUserId, orderId);

    // Every accepted order now waits on the Payments module to confirm the
    // M-Pesa/Pesapal charge. The COD branch that used to sit here returned
    // `requiresPayment: false, status: 'confirmed'` — an unpaid order already
    // in the fulfilment queue — and went with the method itself (E6).
    const payment: PaymentInstruction = {
      method: dto.paymentMethod,
      requiresPayment: true,
      status: 'pending_payment',
      orderId,
      amountKes: detail.totalKes,
      message: 'Order created. Initiate payment via the Payments endpoint to confirm this order.',
    };

    // ── Best-effort confirmation notifications (never block / fail checkout) ──
    void this.sendOrderConfirmation(detail, customer);

    return { order: detail, payment };
  }

  // ─── Customer reads ──────────────────────────────────────────────────────

  /** The caller's own order history (paginated, newest first). */
  async listMyOrders(
    authUserId: string,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedOrders<OrderSummaryView>> {
    const customer = await this.resolveCustomer(authUserId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await this.supabase.client
      .from('orders')
      .select(
        'id, order_number, status, payment_status, payment_method, total_kes, discount_kes, created_at, order_items(quantity)',
        { count: 'exact' },
      )
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as unknown as Array<
      OrderRow & { order_items: { quantity: number }[] | null }
    >;
    const summaries = rows.map((r) => this.toSummary(r));
    return this.paginate(summaries, page, pageSize, count ?? summaries.length);
  }

  /** Full detail for one of the caller's orders. 404 if not theirs. */
  async getOrderDetail(authUserId: string, orderId: string): Promise<OrderDetailView> {
    const customer = await this.resolveCustomer(authUserId);

    const { data, error } = await this.supabase.client
      .from('orders')
      .select(
        `
        id, order_number, status, payment_status, payment_method,
        subtotal_kes, discount_kes, vat_kes, shipping_kes, total_kes,
        promo_code, shipping, notes, created_at, customer_id,
        order_items (
          id, product_id, quantity, unit_price_kes, lens_option,
          product:products ( id, slug, name, brand, images )
        )
        `,
      )
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Order not found.');

    const row = data as unknown as OrderDetailRow;
    // Ownership enforced in code (service-role bypasses RLS).
    if (row.customer_id !== customer.id) {
      throw new NotFoundException('Order not found.');
    }

    return this.toDetail(row);
  }

  /**
   * Status timeline for one of the caller's orders. Maps the `order_status`
   * enum onto the Received → Processing → Dispatched → Delivered stages (W-2
   * fix). Cancelled orders are flagged and light no further stages.
   */
  async getTracking(authUserId: string, orderId: string): Promise<OrderTrackingView> {
    const customer = await this.resolveCustomer(authUserId);

    const { data, error } = await this.supabase.client
      .from('orders')
      .select('id, order_number, status, payment_status, customer_id')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Order not found.');

    const row = data as {
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      customer_id: string;
    };
    if (row.customer_id !== customer.id) {
      throw new NotFoundException('Order not found.');
    }

    const cancelled = row.status === OrderStatus.CANCELLED;
    const currentIndex = cancelled ? -1 : (STATUS_TO_STAGE_INDEX[row.status] ?? -1);

    const stages: TrackingStageView[] = TRACKING_STAGES.map((stage, idx) => ({
      key: stage.key,
      label: stage.label,
      completed: !cancelled && idx <= currentIndex,
      current: !cancelled && idx === currentIndex,
    }));

    return {
      orderId: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      cancelled,
      stages,
    };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  /** Admin order list with optional status / payment filters + pagination. */
  async adminListOrders(
    query: AdminListOrdersQueryDto,
  ): Promise<PaginatedOrders<AdminOrderSummaryView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = this.supabase.client
      .from('orders')
      .select(
        `
        id, order_number, status, payment_status, payment_method,
        total_kes, discount_kes, created_at,
        order_items(quantity),
        customer:customers!customer_id ( id, email, full_name, phone )
        `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) builder = builder.eq('status', query.status);
    if (query.paymentStatus) {
      builder = builder.eq('payment_status', query.paymentStatus);
    }
    if (query.paymentMethod) {
      builder = builder.eq('payment_method', query.paymentMethod);
    }

    const { data, error, count } = await builder;
    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as unknown as Array<
      OrderRow & {
        order_items: { quantity: number }[] | null;
        customer: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
        } | null;
      }
    >;

    const summaries: AdminOrderSummaryView[] = rows.map((r) => ({
      ...this.toSummary(r),
      customer: r.customer
        ? {
            id: r.customer.id,
            email: r.customer.email,
            fullName: r.customer.full_name,
            phone: r.customer.phone,
          }
        : null,
    }));

    return this.paginate(summaries, page, pageSize, count ?? summaries.length);
  }

  /**
   * Move an order through the fulfilment workflow. Validates the transition,
   * persists the new status (and optional note), and fires best-effort SMS +
   * email when the order is dispatched or delivered.
   */
  async adminUpdateStatus(orderId: string, dto: AdminOrderStatusDto): Promise<OrderDetailView> {
    const { data: current, error: readError } = await this.supabase.client
      .from('orders')
      .select('id, status, notes, customer_id')
      .eq('id', orderId)
      .maybeSingle();
    if (readError) throw new BadRequestException(readError.message);
    if (!current) throw new NotFoundException('Order not found.');

    const currentStatus = (current as { status: OrderStatus }).status;
    const nextStatus = dto.status;

    if (nextStatus !== currentStatus) {
      const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Illegal status transition: ${currentStatus} → ${nextStatus}.`,
        );
      }
    }

    const existingNotes = (current as { notes: string | null }).notes;
    const mergedNotes = dto.note
      ? [existingNotes, dto.note].filter(Boolean).join('\n')
      : existingNotes;

    const { error: updateError } = await this.supabase.client
      .from('orders')
      .update({ status: nextStatus, notes: mergedNotes })
      .eq('id', orderId);
    if (updateError) throw new BadRequestException(updateError.message);

    // Re-read the full detail via the admin path (no ownership requirement).
    // H-2 FIX: use the variant that returns contact details explicitly rather
    // than stashing them as a hidden property on the view object.
    const { detail, contact } = await this.adminGetOrderDetailWithContact(orderId);

    if (nextStatus === OrderStatus.DISPATCHED || nextStatus === OrderStatus.DELIVERED) {
      void this.sendStatusUpdate(detail, contact);
    }

    return detail;
  }

  /** Full detail for any order (admin; no ownership check). */
  async adminOrderDetail(orderId: string): Promise<OrderDetailView> {
    return this.adminGetOrderDetail(orderId);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * Resolve the caller's `customers` row from the JWT `auth_user_id`.
   *
   * CRITICAL: the JWT `user.id` equals `customers.auth_user_id`, NOT
   * `customers.id`. Orders reference `customers.id`, so we must translate.
   */
  private async resolveCustomer(authUserId: string): Promise<{
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
  }> {
    const { data, error } = await this.supabase.client
      .from('customers')
      .select('id, email, full_name, phone')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) {
      throw new NotFoundException('No customer profile for the current user.');
    }
    return data as {
      id: string;
      email: string | null;
      full_name: string | null;
      phone: string | null;
    };
  }

  // H-2 FIX: explicit contact shape returned alongside the view so that
  // sendStatusUpdate never needs to reach inside the view via a type cast.
  private async adminGetOrderDetailWithContact(orderId: string): Promise<{
    detail: OrderDetailView;
    contact: { email: string | null; phone: string | null } | null;
  }> {
    const { data, error } = await this.supabase.client
      .from('orders')
      .select(
        `
        id, order_number, status, payment_status, payment_method,
        subtotal_kes, discount_kes, vat_kes, shipping_kes, total_kes,
        promo_code, shipping, notes, created_at, customer_id,
        customer:customers!customer_id ( id, email, full_name, phone ),
        order_items (
          id, product_id, quantity, unit_price_kes, lens_option,
          product:products ( id, slug, name, brand, images )
        )
        `,
      )
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Order not found.');

    const row = data as unknown as OrderDetailRow & {
      customer: {
        id: string;
        email: string | null;
        full_name: string | null;
        phone: string | null;
      } | null;
    };
    return {
      detail: this.toDetail(row),
      contact: row.customer ? { email: row.customer.email, phone: row.customer.phone } : null,
    };
  }

  /** Admin order-detail read (no ownership check). */
  private async adminGetOrderDetail(orderId: string): Promise<OrderDetailView> {
    const { detail } = await this.adminGetOrderDetailWithContact(orderId);
    return detail;
  }

  /** Map a compact order row (+ joined items) to the summary view. */
  private toSummary(
    row: OrderRow & { order_items?: { quantity: number }[] | null },
  ): OrderSummaryView {
    const itemCount = (row.order_items ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0);
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method ?? null,
      totalKes: Number(row.total_kes),
      discountKes: Number(row.discount_kes ?? 0),
      itemCount,
      createdAt: row.created_at,
    };
  }

  /** Map a full order row (+ joined items + products) to the detail view. */
  private toDetail(row: OrderDetailRow): OrderDetailView {
    const items: OrderItemView[] = (row.order_items ?? []).map((it) => {
      const unitPriceKes = Number(it.unit_price_kes);
      return {
        id: it.id,
        productId: it.product_id,
        quantity: it.quantity,
        unitPriceKes,
        lineTotalKes: round2(unitPriceKes * it.quantity),
        lensOption: it.lens_option ?? null,
        product: it.product
          ? {
              id: it.product.id,
              slug: it.product.slug,
              name: it.product.name,
              brand: it.product.brand,
              image: it.product.images?.[0] ?? null,
            }
          : null,
      };
    });
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);

    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method ?? null,
      subtotalKes: Number(row.subtotal_kes),
      discountKes: Number(row.discount_kes ?? 0),
      vatKes: Number(row.vat_kes ?? 0),
      shippingKes: Number(row.shipping_kes ?? 0),
      totalKes: Number(row.total_kes),
      promoCode: row.promo_code ?? null,
      shipping: row.shipping ?? null,
      notes: row.notes ?? null,
      itemCount,
      createdAt: row.created_at,
      items,
    };
  }

  /** Wrap a page of rows in the shared pagination envelope. */
  private paginate<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
  ): PaginatedOrders<T> {
    return {
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Best-effort order-confirmation email + SMS at checkout. Both notification
   * services no-op safely without credentials and never throw, but we still
   * guard with try/catch so a notification failure can never fail a placed order.
   */
  private async sendOrderConfirmation(
    order: OrderDetailView,
    customer: { email: string | null; phone: string | null },
  ): Promise<void> {
    const shipping = order.shipping as { phone?: string } | null;
    const phone = customer.phone ?? shipping?.phone ?? null;
    const summaryLine = `Order ${order.orderNumber} • KES ${order.totalKes.toFixed(2)}`;

    try {
      if (customer.email) {
        await this.email.sendEmail({
          to: customer.email,
          subject: `Optex order confirmation — ${order.orderNumber}`,
          html: this.buildConfirmationHtml(order),
          text: `Thank you for your order. ${summaryLine}. Status: ${order.status}.`,
        });
      }
      if (phone) {
        await this.sms.sendSms(
          phone,
          `Optex: ${summaryLine} received. We'll keep you posted. Asante!`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Order confirmation notification failed for ${order.orderNumber}: ${(e as Error).message}`,
      );
    }
  }

  /** Best-effort dispatch/delivery status notification to the customer. */
  private async sendStatusUpdate(
    order: OrderDetailView,
    // H-2 FIX: explicit parameter instead of hidden __customer property injection
    contact: { email: string | null; phone: string | null } | null,
  ): Promise<void> {
    const shipping = order.shipping as { phone?: string } | null;
    const phone = contact?.phone ?? shipping?.phone ?? null;
    const verb = order.status === OrderStatus.DELIVERED ? 'delivered' : 'dispatched';

    try {
      if (contact?.email) {
        await this.email.sendEmail({
          to: contact.email,
          subject: `Optex order ${order.orderNumber} ${verb}`,
          text: `Good news — your order ${order.orderNumber} has been ${verb}.`,
        });
      }
      if (phone) {
        await this.sms.sendSms(phone, `Optex: your order ${order.orderNumber} has been ${verb}.`);
      }
    } catch (e) {
      this.logger.warn(
        `Status-update notification failed for ${order.orderNumber}: ${(e as Error).message}`,
      );
    }
  }

  /** Minimal HTML body for the confirmation email. */
  private buildConfirmationHtml(order: OrderDetailView): string {
    const rows = order.items
      .map(
        (i) =>
          `<tr><td>${i.product?.name ?? i.productId}</td><td>${i.quantity}</td><td>KES ${i.lineTotalKes.toFixed(2)}</td></tr>`,
      )
      .join('');
    return `
      <h2>Thank you for your order</h2>
      <p>Order number: <strong>${order.orderNumber}</strong></p>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Subtotal: KES ${order.subtotalKes.toFixed(2)}<br/>
         Discount: KES ${order.discountKes.toFixed(2)}<br/>
         VAT (16%): KES ${order.vatKes.toFixed(2)}<br/>
         Shipping: KES ${order.shippingKes.toFixed(2)}<br/>
         <strong>Total: KES ${order.totalKes.toFixed(2)}</strong></p>
    `;
  }
}

// ─── Row shapes ────────────────────────────────────────────────────────────

/** Compact `orders` row shape for list/summary queries. */
interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_kes: number;
  discount_kes: number | null;
  created_at: string;
}

/** Full `orders` row shape (+ joined items + products) for detail queries. */
interface OrderDetailRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal_kes: number;
  discount_kes: number | null;
  vat_kes: number | null;
  shipping_kes: number | null;
  total_kes: number;
  promo_code: string | null;
  shipping: unknown | null;
  notes: string | null;
  created_at: string;
  customer_id: string;
  order_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price_kes: number;
    lens_option: unknown | null;
    product: {
      id: string;
      slug: string;
      name: string;
      brand: string | null;
      images: string[] | null;
    } | null;
  }> | null;
}
