import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
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
/**
 * SPEC-06 R9's threshold default. Same "ours, not the client's" posture as
 * the two above — CLIENT-ANSWERS O-4 is still open. Unlike the eligibility
 * window, falling back to 0 here wouldn't disable anything (it would just
 * auto-decline instantly), but it would still be a silent, surprising
 * behaviour change, so it gets the same never-zero guard for consistency.
 */
const DEFAULT_AUTO_DECLINE_HOURS = 72;

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
    private readonly auditLog: AuditLogService,
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

  /** SPEC-06 R9's threshold, falling back to the documented default. */
  private async loadAutoDeclineHours(): Promise<number> {
    const { data, error } = await this.db
      .from('app_settings')
      .select('value')
      .eq('key', 'cancellation.auto_decline_hours')
      .maybeSingle();
    if (error) {
      this.logger.error(`Could not read auto-decline setting: ${error.message}`);
      return DEFAULT_AUTO_DECLINE_HOURS;
    }
    const raw = Number(data?.value);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AUTO_DECLINE_HOURS;
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
  async listForAdmin(status?: string, branchId?: string) {
    // Audit A-02. `order_cancellation_requests` has no `branch_id` of its own,
    // so the scope comes from the order it points at, via an inner join —
    // `!inner` drops requests whose order is outside the caller's branch
    // instead of returning them with an empty embed. `branch_id` is selected
    // only so the filter has something to reference; the mapper below picks
    // its output fields explicitly, so it never reaches the response.
    const orderEmbed = branchId
      ? 'order:orders!inner(order_number, status, payment_status, total_kes, branch_id)'
      : 'order:orders(order_number, status, payment_status, total_kes)';

    let q = this.db
      .from('order_cancellation_requests')
      .select(
        'id, order_id, reason, status, status_at_request, decline_reason, decided_at, created_at, ' +
          `${orderEmbed}, ` +
          'customer:customers(full_name, email, phone)',
      )
      .order('created_at', { ascending: false });

    if (branchId) q = q.eq('order.branch_id', branchId);
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
      /** Present only on the branch-scoped select above; never returned. */
      branch_id?: string | null;
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
  async pendingCount(branchId?: string): Promise<number> {
    // Audit A-02: the nav badge has to agree with the list it links to,
    // otherwise a branch manager sees a count they can never work off.
    let q = this.db
      .from('order_cancellation_requests')
      .select(branchId ? 'id, order:orders!inner(branch_id)' : 'id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'pending');

    if (branchId) q = q.eq('order.branch_id', branchId);

    const { count, error } = await q;
    if (error) {
      this.logger.error(`Could not count pending cancellations: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }

  /**
   * R2 — cancellation and serial restocking are one database transaction.
   * A separate best-effort restock after `orders.status = cancelled` can lose
   * stock permanently if its RPC fails, so `cancel_order_and_restock` owns
   * both writes and rolls both back together.
   */
  private async cancelAndRestock(orderId: string, actor: AuthUser, notes: string | null = null): Promise<void> {
    const { error } = await this.db.rpc('cancel_order_and_restock', {
      p_order_id: orderId,
      p_notes: notes,
      p_actor_id: actor.id,
      p_actor_role: actor.role ?? 'unknown',
    });
    if (error) {
      this.logger.error(`Could not cancel and restock order ${orderId}: ${error.message}`);
      if (error.message?.includes('order_already_cancelled')) {
        throw new ConflictException('This order has already been cancelled.');
      }
      throw new InternalServerErrorException('Could not cancel that order.');
    }
  }

  /**
   * Loads a request that is still awaiting a decision, and asserts the caller
   * is allowed to decide it.
   *
   * Audit A-02: both `approve` and `decline` go through here, so the branch
   * check lives here rather than being duplicated (and eventually forgotten)
   * in each. A branch-scoped caller deciding another branch's request gets a
   * 404 — not a 403 — matching `adminCancel` and every other scoped surface,
   * so the response doesn't confirm the request exists.
   *
   * `orders.branch_id` is nullable and no storefront order sets it yet, so a
   * branch-scoped caller currently sees no requests to decide. That is the
   * same deliberate consequence `adminCancel` and `adminListOrders` already
   * carry, not a new one introduced here — see `orders.service.ts:342`.
   */
  private async loadPendingRequest(requestId: string, user: AuthUser) {
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

    if (user.branchId) {
      const { data: order, error: orderError } = await this.db
        .from('orders')
        .select('branch_id')
        .eq('id', data.order_id)
        .maybeSingle<{ branch_id: string | null }>();
      if (orderError) {
        this.logger.error(`Order lookup failed for request ${requestId}: ${orderError.message}`);
        throw new InternalServerErrorException('Could not load that request.');
      }
      if (!order || order.branch_id !== user.branchId) {
        throw new NotFoundException('Cancellation request not found.');
      }
    }

    // Checked after ownership so an out-of-branch caller can't distinguish
    // "already decided" from "does not exist".
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
  async approve(actorUser: AuthUser, requestId: string, acknowledgePaid = false) {
    const adminUserId = actorUser.id;
    const req = await this.loadPendingRequest(requestId, actorUser);

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

    await this.cancelAndRestock(order.id, actorUser);

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

    await this.auditLog.record({
      actor: actorUser,
      action: 'cancellations.approve',
      resourceType: 'order_cancellation_requests',
      resourceId: req.id,
      metadata: { orderId: order.id, acknowledgePaid },
    });

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
   *
   * R1 1b (branch scoping): a branch-scoped caller (`user.branchId` set)
   * cannot cancel an order outside their own branch — 404, matching
   * `orders.service.ts`'s `adminUpdateStatus`.
   */
  async adminCancel(
    adminUserId: string,
    orderId: string,
    user: AuthUser,
    reason?: string,
    acknowledgePaid = false,
  ) {
    const { data: order, error } = await this.db
      .from('orders')
      .select('id, status, payment_status, notes, branch_id')
      .eq('id', orderId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Order lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Could not load that order.');
    }
    if (!order) throw new NotFoundException('Order not found.');
    if (user.branchId && (order as { branch_id: string | null }).branch_id !== user.branchId) {
      throw new NotFoundException('Order not found.');
    }
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

    await this.cancelAndRestock(order.id, user, mergedNotes);

    await this.auditLog.record({
      actor: user,
      action: 'orders.cancel',
      resourceType: 'orders',
      resourceId: order.id,
      metadata: { reason: trimmedReason, acknowledgePaid },
    });

    void this.notifyDecision(order.id, 'direct', trimmedReason);

    return { id: order.id, status: 'cancelled' };
  }

  /** Decline a request: the order keeps the status it already had — R3. */
  async decline(actorUser: AuthUser, requestId: string, reason?: string) {
    const adminUserId = actorUser.id;
    const req = await this.loadPendingRequest(requestId, actorUser);

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

    await this.auditLog.record({
      actor: actorUser,
      action: 'cancellations.decline',
      resourceType: 'order_cancellation_requests',
      resourceId: req.id,
      metadata: { reason: reason?.trim() || null },
    });

    void this.notifyDecision(req.order_id, 'declined', reason?.trim() || null);

    // Deliberately no order write. Declining means nothing changed, so the
    // order keeps the status it already had — R3.
    return { id: req.id, status: 'declined' };
  }

  /**
   * Auto-decline requests nobody has answered — SPEC-06 R9. Run on a cron
   * ({@link CancellationAutoDeclineJob}), not from a route: this is upkeep,
   * not something an admin triggers.
   *
   * A single bulk `UPDATE ... WHERE status = 'pending'` rather than a
   * read-then-write loop: the WHERE clause is the concurrency guard, so an
   * admin who approves or declines a request in the same instant this runs
   * simply doesn't match it — there's no window where both writers act on the
   * same row. `decided_by` stays null; nobody decided this, the clock did.
   *
   * Like every other outcome here, this never reaches for a refund — an
   * auto-declined request leaves the order exactly where it was.
   *
   * Unlike `approve()`/`decline()`, the notifications here are awaited rather
   * than fire-and-forget: those exist to keep an admin's HTTP response fast,
   * and nothing here is waiting on a response. `notifyDecision` still catches
   * its own errors, so one bad send can't fail the sweep or leave the DB
   * write reflecting anything but what actually happened.
   */
  async autoDeclineStale(): Promise<{ declined: number }> {
    const hours = await this.loadAutoDeclineHours();
    const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
    const reason = `Automatically declined — nobody responded within ${hours} hours. Please call your branch if you would still like to cancel this order.`;

    const { data, error } = await this.db
      .from('order_cancellation_requests')
      .update({
        status: 'declined',
        decline_reason: reason,
        decided_by: null,
        decided_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id, order_id');

    if (error) {
      this.logger.error(`Auto-decline sweep failed: ${error.message}`);
      return { declined: 0 };
    }

    const rows = data ?? [];
    await Promise.all(
      rows.map((row) => this.notifyDecision(row.order_id as string, 'declined', reason)),
    );
    return { declined: rows.length };
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
