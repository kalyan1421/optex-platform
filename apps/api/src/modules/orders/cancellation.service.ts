import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';

/**
 * Customer-requested order cancellation — SPEC-06.
 *
 * The client chose a request/approval workflow rather than self-service
 * (CLIENT-ANSWERS B5): the customer asks, an admin decides. That is deliberate.
 * Whether a cancellation is acceptable depends on how far into fulfilment the
 * order is, and Optex wants a person to make that call.
 *
 * NO REFUNDS ARE EVER INITIATED HERE. Client policy is "no refunds", and SPEC-06
 * is explicit that a cancellation is not a refund. Approving a cancellation on a
 * paid order flags it for manual handling; the system never calls a provider.
 */

/** Fulfilment order, earliest first. Index position is the comparison. */
const STAGE_ORDER = [
  'pending_payment',
  'received',
  'processing',
  'dispatched',
  'delivered',
] as const;

/**
 * Defaults applied when `app_settings` has no row, or holds something
 * unusable.
 *
 * SPEC-06 R2 is explicit that an unset value must fall back to a documented
 * default and *never* to zero — a zero window would make every order
 * ineligible and the storefront would simply stop offering cancellation, with
 * nothing in the logs to say why.
 *
 * These numbers are ours, not the client's: CLIENT-ANSWERS O-4 is still open on
 * the real thresholds. They are configuration so that being wrong costs a
 * minute rather than a release.
 */
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_MAX_STAGE = 'processing';

export interface CancellationEligibility {
  eligible: boolean;
  /** Customer-facing explanation when not eligible. Null when eligible. */
  reason: string | null;
  windowHours: number;
  maxStage: string;
}

interface OrderRow {
  id: string;
  customer_id: string;
  status: string;
  payment_status: string;
  created_at: string;
}

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  /** Read the two cancellation settings, falling back to documented defaults. */
  async loadRules(): Promise<{ windowHours: number; maxStage: string }> {
    const { data, error } = await this.db
      .from('app_settings')
      .select('key, value')
      .in('key', ['cancellation.window_hours', 'cancellation.max_stage']);

    if (error) {
      // Configuration being unreadable must not take cancellation down with it.
      this.logger.error(`Could not read cancellation settings: ${error.message}`);
      return { windowHours: DEFAULT_WINDOW_HOURS, maxStage: DEFAULT_MAX_STAGE };
    }

    const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));

    const rawHours = Number(byKey.get('cancellation.window_hours'));
    // `> 0` rejects 0, NaN and negatives together — all of which would disable
    // cancellation silently.
    const windowHours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : DEFAULT_WINDOW_HOURS;

    const rawStage = byKey.get('cancellation.max_stage');
    const maxStage =
      typeof rawStage === 'string' && (STAGE_ORDER as readonly string[]).includes(rawStage)
        ? rawStage
        : DEFAULT_MAX_STAGE;

    return { windowHours, maxStage };
  }

  /**
   * Can this order still be cancelled?
   *
   * Computed here, never in the storefront — SPEC-06 R2. The client displays
   * the answer and the reason; it does not decide, because a client that
   * decides can be made to decide differently.
   */
  async evaluate(order: { status: string; created_at: string }): Promise<CancellationEligibility> {
    const { windowHours, maxStage } = await this.loadRules();
    const base = { windowHours, maxStage };

    if (order.status === 'cancelled') {
      return { eligible: false, reason: 'This order has already been cancelled.', ...base };
    }

    const stageIndex = STAGE_ORDER.indexOf(order.status as (typeof STAGE_ORDER)[number]);
    const maxIndex = STAGE_ORDER.indexOf(maxStage as (typeof STAGE_ORDER)[number]);
    if (stageIndex === -1) {
      return { eligible: false, reason: 'This order cannot be cancelled online.', ...base };
    }
    if (stageIndex > maxIndex) {
      return {
        eligible: false,
        reason: 'Orders can no longer be cancelled once they have been dispatched.',
        ...base,
      };
    }

    const ageHours = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000;
    if (ageHours > windowHours) {
      return {
        eligible: false,
        reason: `Cancellation is only available within ${windowHours} hours of placing an order. Please call your branch.`,
        ...base,
      };
    }

    return { eligible: true, reason: null, ...base };
  }

  /** The caller's order, or 404 — never another customer's. */
  private async resolveOwnedOrder(authUserId: string, orderId: string): Promise<OrderRow> {
    const { data: customer } = await this.db
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!customer) throw new NotFoundException('Order not found.');

    const { data: order, error } = await this.db
      .from('orders')
      .select('id, customer_id, status, payment_status, created_at')
      .eq('id', orderId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Order lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load that order.');
    }
    // Same 404 for "does not exist" and "not yours" — distinguishing them would
    // confirm the existence of another customer's order.
    if (!order || order.customer_id !== customer.id) {
      throw new NotFoundException('Order not found.');
    }
    return order as OrderRow;
  }

  /** SPEC-06 R1 — a customer requests cancellation on their own order. */
  async request(authUserId: string, orderId: string, reason?: string) {
    const order = await this.resolveOwnedOrder(authUserId, orderId);

    const eligibility = await this.evaluate(order);
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reason ?? 'This order cannot be cancelled.');
    }

    const { data, error } = await this.db
      .from('order_cancellation_requests')
      .insert({
        order_id: order.id,
        customer_id: order.customer_id,
        reason: reason?.trim() || null,
        status_at_request: order.status,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      // The partial unique index on (order_id) where status='pending' is what
      // actually prevents duplicates — two rapid taps race past any check we
      // could write in application code.
      if (error.code === '23505') {
        throw new ConflictException('A cancellation request for this order is already pending.');
      }
      this.logger.error(`Could not record cancellation request: ${error.message}`);
      throw new InternalServerErrorException('Could not submit that request.');
    }

    return {
      id: data!.id,
      status: data!.status,
      createdAt: data!.created_at,
      // Received, NOT approved — SPEC-06 R1 is explicit that the customer must
      // not be told their order is cancelled before an admin has decided.
      message: 'Your cancellation request has been received. We will confirm shortly.',
    };
  }

  /** Eligibility plus any open request, for the order and tracking pages. */
  async statusFor(authUserId: string, orderId: string) {
    const order = await this.resolveOwnedOrder(authUserId, orderId);
    const eligibility = await this.evaluate(order);

    const { data: existing } = await this.db
      .from('order_cancellation_requests')
      .select('id, status, reason, decline_reason, created_at, decided_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      orderId: order.id,
      canRequest: eligibility.eligible && existing?.status !== 'pending',
      ineligibleReason: eligibility.reason,
      windowHours: eligibility.windowHours,
      request: existing ?? null,
    };
  }
  // ─── Admin ────────────────────────────────────────────────────────────────

  /**
   * Pending requests first, then decided ones — SPEC-06 R3.
   *
   * Each row carries what an admin needs to decide without opening the order:
   * who asked, why, how long ago, whether the money has been taken, and how far
   * into fulfilment it is now. `statusAtRequest` is kept alongside the order's
   * current status because they can differ — an order dispatched while the
   * request sat pending is the case R3 wants flagged.
   */
  async listForAdmin(status?: string) {
    let q = this.db
      .from('order_cancellation_requests')
      .select(
        'id, order_id, reason, status, status_at_request, decline_reason, decided_at, created_at, ' +
          'order:orders(order_number, status, payment_status, total_kes), ' +
          'customer:customers(full_name, email, phone)',
      )
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) {
      this.logger.error(`Could not list cancellation requests: ${error.message}`);
      throw new InternalServerErrorException('Could not load cancellation requests.');
    }

    // PostgREST returns a to-one embed as either an object or a single-element
    // array depending on how it infers the relationship — the same shape the
    // reviews and inventory services normalise.
    interface EmbeddedOrder {
      order_number: string;
      status: string;
      payment_status: string;
      total_kes: number;
    }
    interface EmbeddedCustomer {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    }
    type Embed<T> = T | T[] | null;
    const unwrap = <T>(embed: Embed<T>): T | null =>
      Array.isArray(embed) ? (embed[0] ?? null) : embed;

    type Row = {
      order: Embed<EmbeddedOrder>;
      customer: Embed<EmbeddedCustomer>;
      status_at_request: string;
      [key: string]: unknown;
    };

    return ((data ?? []) as unknown as Row[]).map((row) => {
      const { order, customer, ...rest } = row;
      const o = unwrap<EmbeddedOrder>(order);
      const c = unwrap<EmbeddedCustomer>(customer);
      return {
        ...rest,
        orderNumber: o?.order_number ?? null,
        orderStatus: o?.status ?? null,
        paymentStatus: o?.payment_status ?? null,
        totalKes: o?.total_kes ?? null,
        customerName: c?.full_name ?? null,
        customerEmail: c?.email ?? null,
        customerPhone: c?.phone ?? null,
        // R3: the order moved on while the request waited. Surfaced as a field
        // rather than left for the admin to spot by comparing two columns.
        movedSinceRequest: !!o && o.status !== rest.status_at_request,
      };
    });
  }

  /** Count of requests still awaiting a decision — for the admin nav badge. */
  async pendingCount(): Promise<number> {
    const { count, error } = await this.db
      .from('order_cancellation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) {
      this.logger.error(`Could not count pending cancellations: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }

  private async loadPendingRequest(requestId: string) {
    const { data, error } = await this.db
      .from('order_cancellation_requests')
      .select('id, order_id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Cancellation request lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load that request.');
    }
    if (!data) throw new NotFoundException('Cancellation request not found.');
    if (data.status !== 'pending') {
      throw new ConflictException(`This request has already been ${data.status}.`);
    }
    return data;
  }

  /**
   * Approve a request: the order is cancelled — SPEC-06 R3.
   *
   * `acknowledgePaid` is required when the money has already been taken (R5).
   * Client policy is "no refunds", so cancelling a paid order is a decision
   * with a financial consequence that someone has to own; the API refuses to
   * infer consent for it. Nothing here ever calls a payment provider.
   */
  async approve(adminUserId: string, requestId: string, acknowledgePaid = false) {
    const req = await this.loadPendingRequest(requestId);

    const { data: order } = await this.db
      .from('orders')
      .select('id, status, payment_status')
      .eq('id', req.order_id)
      .maybeSingle();
    if (!order) throw new NotFoundException('The order for this request no longer exists.');

    if (order.payment_status === 'paid' && !acknowledgePaid) {
      throw new BadRequestException(
        'This order has been paid. Cancelling it does not refund the customer — confirm you will handle the refund manually.',
      );
    }

    const { error: orderError } = await this.db
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id);
    if (orderError) {
      this.logger.error(`Could not cancel order ${order.id}: ${orderError.message}`);
      throw new InternalServerErrorException('Could not cancel that order.');
    }

    const { error } = await this.db
      .from('order_cancellation_requests')
      .update({ status: 'approved', decided_by: adminUserId, decided_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) {
      // The order is already cancelled. Surfacing the failure is better than
      // pretending it worked — the request row can be reconciled by hand, but a
      // silent mismatch between order and request would mislead the next admin.
      this.logger.error(`Order ${order.id} cancelled but request not updated: ${error.message}`);
      throw new InternalServerErrorException(
        'The order was cancelled but the request could not be updated. Please check the request list.',
      );
    }

    // After the write, never before — see notifyDecision.
    void this.notifyDecision(order.id, 'approved');

    return { id: req.id, status: 'approved', orderStatus: 'cancelled' };
  }

  /**
   * Cancel an order with no customer request behind it — SPEC-06 R3, "the
   * phone-call path". A customer who rings the branch instead of using the
   * app still gets the same protections as one who went through
   * `approve()`: the same paid-order acknowledgement gate, the same
   * never-refund guarantee, the same notification afterwards.
   *
   * Declines to run if a request is already pending for this order — that
   * request is the record of what the customer asked for, and letting two
   * code paths both decide it would leave it unclear which decision, and
   * whose, actually stuck. The admin resolves the pending request instead.
   */
  async adminCancel(
    adminUserId: string,
    orderId: string,
    reason?: string,
    acknowledgePaid = false,
  ) {
    const { data: order, error } = await this.db
      .from('orders')
      .select('id, status, payment_status, notes')
      .eq('id', orderId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Order lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load that order.');
    }
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status === 'cancelled') {
      throw new ConflictException('This order has already been cancelled.');
    }
    if (order.status === 'delivered') {
      throw new BadRequestException('Delivered orders cannot be cancelled.');
    }

    const { data: pending } = await this.db
      .from('order_cancellation_requests')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .maybeSingle();
    if (pending) {
      throw new ConflictException(
        'This order has a pending cancellation request — decide it from Cancellation requests instead.',
      );
    }

    if (order.payment_status === 'paid' && !acknowledgePaid) {
      throw new BadRequestException(
        'This order has been paid. Cancelling it does not refund the customer — confirm you will handle the refund manually.',
      );
    }

    const trimmedReason = reason?.trim() || null;
    const note = trimmedReason
      ? `Cancelled by admin: ${trimmedReason}`
      : 'Cancelled by admin (no reason given).';
    const mergedNotes = [order.notes as string | null, note].filter(Boolean).join('\n');

    const { error: updateError } = await this.db
      .from('orders')
      .update({ status: 'cancelled', notes: mergedNotes })
      .eq('id', order.id);
    if (updateError) {
      this.logger.error(`Could not cancel order ${order.id}: ${updateError.message}`);
      throw new InternalServerErrorException('Could not cancel that order.');
    }

    void this.notifyDecision(order.id, 'direct', trimmedReason);

    return { id: order.id, status: 'cancelled' };
  }

  /** Decline a request: the order keeps the status it already had — R3. */
  async decline(adminUserId: string, requestId: string, reason?: string) {
    const req = await this.loadPendingRequest(requestId);

    const { error } = await this.db
      .from('order_cancellation_requests')
      .update({
        status: 'declined',
        decline_reason: reason?.trim() || null,
        decided_by: adminUserId,
        decided_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    if (error) {
      this.logger.error(`Could not decline request ${req.id}: ${error.message}`);
      throw new InternalServerErrorException('Could not decline that request.');
    }

    void this.notifyDecision(req.order_id, 'declined', reason?.trim() || null);

    // Deliberately no order write. Declining means nothing changed, so the
    // order keeps the status it already had — R3.
    return { id: req.id, status: 'declined' };
  }
  /**
   * Tell the customer what was decided — SPEC-06 R4.
   *
   * Best-effort, and deliberately called *after* the decision is committed:
   * "notification failure never blocks or reverses the decision". An admin who
   * approved a cancellation has approved it, whether or not Resend was
   * reachable. Matches the pattern OrdersService already uses for confirmations.
   *
   * The decline path carries the admin's reason, because a decline without one
   * is the thing this feature exists to replace — a customer left to phone a
   * branch and ask why.
   *
   * `direct` covers `adminCancel()` — there is no request to say "as you
   * requested" about, since a phone call leaves no record here, so the
   * wording stays neutral and only adds the admin's reason when one was given.
   */
  private async notifyDecision(
    orderId: string,
    outcome: 'approved' | 'declined' | 'direct',
    declineReason?: string | null,
  ): Promise<void> {
    try {
      const { data } = await this.db
        .from('orders')
        .select('order_number, customer:customers(email, phone)')
        .eq('id', orderId)
        .maybeSingle();
      if (!data) return;

      const embed = (data as { customer: unknown }).customer;
      const customer = (Array.isArray(embed) ? embed[0] : embed) as {
        email: string | null;
        phone: string | null;
      } | null;
      const orderNumber = (data as { order_number: string }).order_number;

      let subject: string;
      let body: string;
      if (outcome === 'approved') {
        subject = `Your Optex order ${orderNumber} has been cancelled`;
        body = `Order ${orderNumber} has been cancelled as you requested.`;
      } else if (outcome === 'direct') {
        subject = `Your Optex order ${orderNumber} has been cancelled`;
        body = `Order ${orderNumber} has been cancelled.${
          declineReason ? ` ${declineReason}` : ''
        } Please call your branch if you have any questions.`;
      } else {
        subject = `About your cancellation request — ${orderNumber}`;
        body = `We could not cancel order ${orderNumber}.${
          declineReason ? ` ${declineReason}` : ''
        } Please call your branch if you would like to discuss it.`;
      }

      if (customer?.email) {
        await this.email.sendEmail({
          to: customer.email,
          subject,
          html: `<p>${body}</p>`,
          text: body,
        });
      }
      if (customer?.phone) {
        await this.sms.sendSms(customer.phone, `Optex: ${body}`);
      }
    } catch (e) {
      this.logger.warn(
        `Cancellation ${outcome} notification failed for order ${orderId}: ${(e as Error).message}`,
      );
    }
  }
}
