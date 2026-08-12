import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

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

  constructor(private readonly supabase: SupabaseService) {}

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
}
