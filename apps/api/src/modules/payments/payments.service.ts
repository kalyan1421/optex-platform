import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';
import { MpesaService } from './mpesa.service';
import { PesapalService } from './pesapal.service';
import { FINAL_TX_STATUSES, TX_STATUS, normalizeKenyanMsisdn } from './payments.constants';
import {
  AdminListPaymentsQueryDto,
  PaymentProviderFilter,
} from './dto/admin-list-payments-query.dto';
import { ReconcileProvider } from './dto/reconcile-payment.dto';
import {
  AdminPaymentView,
  MpesaStatusView,
  MpesaStkPushResult,
  PaginatedPayments,
  PesapalInitiateResult,
  PesapalStatusView,
  ReconcileResult,
} from './dto/payment-views';

/**
 * Daraja CheckoutRequestIDs look like `ws_CO_04112024103045123456789` — letters,
 * digits and underscores only. Anything else cannot be one of ours, and is
 * rejected before it reaches a query. Deliberately excludes `,` `.` `(` `)` and
 * `:`, the characters PostgREST's filter grammar is built from.
 */
const MPESA_CHECKOUT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** Minimal `orders` row shape needed across the payment flows. */
interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  total_kes: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
}

/** `mpesa_transactions` row shape (mirrors migration 0001 + database.types). */
interface MpesaTxRow {
  id: string;
  mpesa_ref: string;
  amount_kes: number;
  customer_phone: string | null;
  order_id: string | null;
  raw: Record<string, unknown> | null;
  status: string;
  received_at: string;
}

/** `pesapal_transactions` row shape. */
interface PesapalTxRow {
  id: string;
  pesapal_order_id: string;
  amount_kes: number | null;
  method: string | null;
  order_id: string | null;
  raw: Record<string, unknown> | null;
  status: string | null;
  received_at: string;
}

/** Customer contact fields resolved alongside an order for notifications. */
interface CustomerContact {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
}

/** Daraja STK callback body (`Body.stkCallback`). */
interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: { Name: string; Value?: unknown }[] };
}

/**
 * PAYMENTS facade — owns all DB writes for the M-Pesa + Pesapal rails, order
 * resolution, idempotent webhook reconciliation, and best-effort confirmations.
 * The thin `MpesaService` / `PesapalService` clients stay HTTP-only so the Cron
 * module can reuse them; all stateful logic lives here.
 *
 * SECURITY: uses the service-role client (RLS-bypassing). Ownership is enforced
 * IN CODE — customer-initiated flows resolve `customers.id` from the JWT
 * `auth_user_id` and verify the order belongs to that customer. Webhooks are
 * unauthenticated (no JWT) so they rely on the provider tracking ids +
 * idempotency, never on caller identity.
 *
 * MONEY SAFETY: the charged amount is always the order's `total_kes` read from
 * the DB — never a client-supplied figure. An order is credited at most once:
 * webhook/reconcile checks (a) the transaction isn't already in a FINAL status
 * and (b) the order isn't already `paid` before applying.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mpesa: MpesaService,
    private readonly pesapal: PesapalService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  // ───────────────────────── M-Pesa ──────────────────────────────────────

  /**
   * Initiate an STK push for one of the caller's pending-payment orders.
   *
   * IDEMPOTENCY: `mpesa_transactions` has a single unique key (`mpesa_ref`). No
   * CheckoutRequestID column exists, so until a real M-Pesa receipt arrives we
   * use the CheckoutRequestID AS the `mpesa_ref` placeholder (also stored in
   * `raw.CheckoutRequestID`/`raw.MerchantRequestID`). The callback later swaps
   * `mpesa_ref` to the real MpesaReceiptNumber. Lookups by CheckoutRequestID
   * therefore hit the unique index. A second STK attempt for the same order
   * simply inserts a new pending row keyed by a new CheckoutRequestID.
   */
  async initiateMpesaStkPush(
    authUserId: string,
    orderId: string,
    rawPhone: string,
  ): Promise<MpesaStkPushResult> {
    const phone = normalizeKenyanMsisdn(rawPhone);
    if (!phone) {
      throw new BadRequestException(
        'Invalid phone number — expected a Kenyan MSISDN (e.g. 0712345678).',
      );
    }

    const { order } = await this.resolveOwnedOrder(authUserId, orderId);
    this.assertPayable(order);

    const push = await this.mpesa.stkPush({
      amount: order.total_kes,
      phone,
      accountReference: order.order_number,
      transactionDesc: `Order ${order.order_number}`.slice(0, 13),
    });

    // Persist the pending transaction keyed by CheckoutRequestID.
    const { error } = await this.db.from('mpesa_transactions').insert({
      mpesa_ref: push.CheckoutRequestID,
      amount_kes: order.total_kes,
      customer_phone: phone,
      order_id: order.id,
      status: TX_STATUS.PENDING,
      raw: {
        stage: 'stk_push',
        MerchantRequestID: push.MerchantRequestID,
        CheckoutRequestID: push.CheckoutRequestID,
        ResponseCode: push.ResponseCode,
        ResponseDescription: push.ResponseDescription,
        CustomerMessage: push.CustomerMessage,
      },
    });
    if (error) {
      // Unique violation = a row for this CheckoutRequestID already exists
      // (Daraja replayed the same id). Treat as already-initiated, not fatal.
      if (error.code !== '23505') {
        this.logger.error(`Failed to persist M-Pesa transaction: ${error.message}`);
        throw new InternalServerErrorException('Could not record the payment attempt.');
      }
    }

    return {
      checkoutRequestId: push.CheckoutRequestID,
      merchantRequestId: push.MerchantRequestID ?? null,
      message:
        push.CustomerMessage ??
        'STK push sent. Enter your M-Pesa PIN on your phone to complete payment.',
    };
  }

  /**
   * Query the live status of an STK push (authed) and reconcile if the push has
   * resolved. Order ownership is checked via the stored transaction's order.
   */
  async queryMpesaStatus(authUserId: string, checkoutRequestId: string): Promise<MpesaStatusView> {
    const tx = await this.findMpesaTxByCheckout(checkoutRequestId);
    if (!tx) {
      throw new NotFoundException('No M-Pesa transaction for that request id.');
    }
    if (tx.order_id) {
      // Confirm the caller owns the order behind this transaction.
      await this.resolveOwnedOrder(authUserId, tx.order_id);
    }

    const result = await this.mpesa.stkQuery(checkoutRequestId);
    const resultCode = result.ResultCode !== undefined ? Number(result.ResultCode) : null;

    // Reconcile from the query result if it resolved and the tx is still open.
    if (resultCode !== null && !FINAL_TX_STATUSES.includes(tx.status)) {
      if (resultCode === 0) {
        await this.applyMpesaSuccess(tx, {
          ResultCode: 0,
          ResultDesc: result.ResultDesc,
          source: 'query',
        });
      } else {
        await this.markMpesaFailed(tx, resultCode, result.ResultDesc ?? null, {
          source: 'query',
        });
      }
    }

    const fresh = (await this.findMpesaTxByCheckout(checkoutRequestId)) ?? tx;
    return {
      checkoutRequestId,
      resultCode,
      resultDesc: result.ResultDesc ?? null,
      status: fresh.status,
      orderId: fresh.order_id,
      paid: fresh.status === TX_STATUS.MATCHED,
    };
  }

  /**
   * Handle the Daraja STK callback. IDEMPOTENT + always returns Daraja's
   * required ack regardless of outcome (the controller wraps the ack).
   */
  async handleMpesaCallback(body: unknown): Promise<void> {
    const stk = this.extractStkCallback(body);
    if (!stk?.CheckoutRequestID) {
      this.logger.warn('M-Pesa callback missing stkCallback/CheckoutRequestID');
      return;
    }

    const tx = await this.findMpesaTxByCheckout(stk.CheckoutRequestID);
    if (!tx) {
      // Unknown CheckoutRequestID — log the raw payload for manual recon but
      // still ack so Daraja stops retrying.
      this.logger.warn(`M-Pesa callback for unknown CheckoutRequestID ${stk.CheckoutRequestID}`);
      return;
    }

    // IDEMPOTENCY: ignore if this transaction already reached a final state.
    if (FINAL_TX_STATUSES.includes(tx.status)) {
      this.logger.log(`M-Pesa callback ignored — tx ${tx.id} already ${tx.status}`);
      return;
    }

    const resultCode = Number(stk.ResultCode);
    if (resultCode === 0) {
      const meta = this.extractCallbackMetadata(stk.CallbackMetadata);
      await this.applyMpesaSuccess(tx, {
        ResultCode: 0,
        ResultDesc: stk.ResultDesc,
        receiptNumber: meta.MpesaReceiptNumber,
        phoneNumber: meta.PhoneNumber,
        amount: meta.Amount,
        source: 'callback',
        raw: stk,
      });
    } else {
      await this.markMpesaFailed(tx, resultCode, stk.ResultDesc ?? null, {
        source: 'callback',
        raw: stk,
      });
    }
  }

  /** Mark an M-Pesa transaction successful + credit its order (idempotent). */
  private async applyMpesaSuccess(
    tx: MpesaTxRow,
    info: {
      ResultCode: number;
      ResultDesc?: string | null;
      receiptNumber?: string;
      phoneNumber?: string;
      amount?: number;
      source: string;
      raw?: unknown;
    },
  ): Promise<void> {
    if (FINAL_TX_STATUSES.includes(tx.status)) return;

    // AMOUNT VERIFICATION: Daraja STK callbacks are not signed and the endpoint
    // is public, so the paid amount is the only thing standing between a forged
    // callback and a credited order. We confirm it matches what we pushed
    // (tx.amount_kes, itself derived from order.total_kes at push time).
    //
    // A MISSING amount is treated exactly like a mismatched one. It used to be
    // treated as "nothing to check" and fell through to crediting the order —
    // which meant a forged callback carrying ResultCode 0 and no
    // CallbackMetadata, replayed against a real CheckoutRequestID from the
    // attacker's own unpaid STK push, marked that order paid. A success
    // callback that cannot prove its amount is not a success.
    const paidAmount = info.amount === undefined ? null : Number(info.amount);
    const amountUnverified = paidAmount === null || !Number.isFinite(paidAmount);
    const amountMismatched =
      !amountUnverified && Math.abs(paidAmount - Number(tx.amount_kes)) > 0.01;

    if (amountUnverified || amountMismatched) {
      this.logger.error(
        amountUnverified
          ? `M-Pesa success callback for tx ${tx.id} carried no usable amount — refusing to credit, holding for manual reconcile`
          : `M-Pesa amount mismatch on tx ${tx.id}: expected ${tx.amount_kes}, paid ${paidAmount} — holding for manual reconcile`,
      );
      await this.db
        .from('mpesa_transactions')
        .update({
          raw: {
            ...(tx.raw ?? {}),
            stage: amountUnverified ? 'amount_missing' : 'amount_mismatch',
            source: info.source,
            expected_amount: tx.amount_kes,
            paid_amount: info.amount ?? null,
            callback: info.raw ?? null,
          },
        })
        .eq('id', tx.id);
      return;
    }

    // Prefer the real M-Pesa receipt as the permanent reference; fall back to
    // the CheckoutRequestID we stored at push time.
    const mpesaRef = info.receiptNumber ?? tx.mpesa_ref;

    const { error } = await this.db
      .from('mpesa_transactions')
      .update({
        mpesa_ref: mpesaRef,
        status: TX_STATUS.MATCHED,
        customer_phone: info.phoneNumber ? String(info.phoneNumber) : tx.customer_phone,
        raw: {
          ...(tx.raw ?? {}),
          stage: 'callback_success',
          source: info.source,
          ResultCode: info.ResultCode,
          ResultDesc: info.ResultDesc ?? null,
          MpesaReceiptNumber: info.receiptNumber ?? null,
          callback: info.raw ?? null,
        },
      })
      .eq('id', tx.id)
      .neq('status', TX_STATUS.MATCHED); // guard against a concurrent apply
    if (error) {
      // A unique-violation on mpesa_ref means the receipt is already recorded
      // (duplicate callback) — safe to treat as done.
      if (error.code === '23505') {
        this.logger.log(`M-Pesa receipt ${mpesaRef} already recorded`);
        return;
      }
      this.logger.error(`Failed to mark M-Pesa tx matched: ${error.message}`);
      return;
    }

    if (tx.order_id) {
      await this.creditOrder(tx.order_id, 'mpesa', mpesaRef);
    }
  }

  /** Mark an M-Pesa transaction failed (idempotent; never credits the order). */
  private async markMpesaFailed(
    tx: MpesaTxRow,
    resultCode: number,
    resultDesc: string | null,
    info: { source: string; raw?: unknown },
  ): Promise<void> {
    if (FINAL_TX_STATUSES.includes(tx.status)) return;
    const { error } = await this.db
      .from('mpesa_transactions')
      .update({
        status: TX_STATUS.FAILED,
        raw: {
          ...(tx.raw ?? {}),
          stage: 'callback_failed',
          source: info.source,
          ResultCode: resultCode,
          ResultDesc: resultDesc,
          callback: info.raw ?? null,
        },
      })
      .eq('id', tx.id)
      .neq('status', TX_STATUS.MATCHED);
    if (error) {
      this.logger.error(`Failed to mark M-Pesa tx failed: ${error.message}`);
    }
  }

  // ───────────────────────── Pesapal ─────────────────────────────────────

  /** Initiate a Pesapal payment for one of the caller's pending orders. */
  async initiatePesapal(authUserId: string, orderId: string): Promise<PesapalInitiateResult> {
    const { order, customer } = await this.resolveOwnedOrder(authUserId, orderId);
    this.assertPayable(order);

    const [firstName, ...rest] = (customer?.full_name ?? '').trim().split(' ');
    const submitted = await this.pesapal.submitOrder({
      merchantReference: order.order_number,
      amount: order.total_kes,
      description: `Optex order ${order.order_number}`,
      billing: {
        email_address: customer?.email ?? undefined,
        phone_number: customer?.phone ?? undefined,
        first_name: firstName || undefined,
        last_name: rest.join(' ') || undefined,
      },
    });

    const { error } = await this.db.from('pesapal_transactions').insert({
      pesapal_order_id: submitted.order_tracking_id,
      amount_kes: order.total_kes,
      order_id: order.id,
      status: TX_STATUS.PENDING,
      raw: {
        stage: 'submit',
        merchant_reference: submitted.merchant_reference,
        redirect_url: submitted.redirect_url,
      },
    });
    if (error && error.code !== '23505') {
      this.logger.error(`Failed to persist Pesapal transaction: ${error.message}`);
      throw new InternalServerErrorException('Could not record the payment attempt.');
    }

    // Record the tracking id on the order for cross-reference (best-effort).
    await this.db
      .from('orders')
      .update({ pesapal_id: submitted.order_tracking_id })
      .eq('id', order.id);

    return {
      orderTrackingId: submitted.order_tracking_id,
      redirectUrl: submitted.redirect_url,
      message: 'Redirect the customer to complete payment.',
    };
  }

  /** Query + reconcile a Pesapal transaction (authed; ownership checked). */
  async queryPesapalStatus(
    authUserId: string,
    orderTrackingId: string,
  ): Promise<PesapalStatusView> {
    const tx = await this.findPesapalTx(orderTrackingId);
    if (!tx) {
      throw new NotFoundException('No Pesapal transaction for that tracking id.');
    }
    if (tx.order_id) {
      await this.resolveOwnedOrder(authUserId, tx.order_id);
    }

    const status = await this.reconcilePesapal(tx);
    return status;
  }

  /**
   * Handle the Pesapal IPN. The IPN body is NOT trusted — we read only the
   * OrderTrackingId from it, then call GetTransactionStatus to resolve the real
   * outcome. IDEMPOTENT.
   */
  async handlePesapalIpn(orderTrackingId: string): Promise<void> {
    if (!orderTrackingId) {
      this.logger.warn('Pesapal IPN missing OrderTrackingId');
      return;
    }
    const tx = await this.findPesapalTx(orderTrackingId);
    if (!tx) {
      this.logger.warn(`Pesapal IPN for unknown OrderTrackingId ${orderTrackingId}`);
      return;
    }
    if (FINAL_TX_STATUSES.includes(tx.status ?? '')) {
      this.logger.log(`Pesapal IPN ignored — tx ${tx.id} already ${tx.status}`);
      return;
    }
    await this.reconcilePesapal(tx);
  }

  /**
   * Re-query Pesapal for the authoritative status and apply it idempotently.
   * Returns the resolved status view.
   */
  private async reconcilePesapal(tx: PesapalTxRow): Promise<PesapalStatusView> {
    const remote = await this.pesapal.getTransactionStatus(tx.pesapal_order_id);
    const code = remote.status_code ?? null;
    const desc = remote.payment_status_description ?? null;

    // status_code: 1 COMPLETED, 2 FAILED, 3 REVERSED, 0 INVALID/pending.
    let nextStatus = tx.status ?? TX_STATUS.PENDING;
    const alreadyFinal = FINAL_TX_STATUSES.includes(tx.status ?? '');

    if (!alreadyFinal) {
      if (code === 1) nextStatus = TX_STATUS.MATCHED;
      else if (code === 2) nextStatus = TX_STATUS.FAILED;
      else if (code === 3) nextStatus = TX_STATUS.REVERSED;
      else nextStatus = TX_STATUS.PENDING;

      // AMOUNT VERIFICATION: a "completed" Pesapal payment is only credited when
      // the provider-reported amount matches what we submitted (tx.amount_kes,
      // derived from order.total_kes). On mismatch we keep the tx PENDING and
      // hold for manual reconcile rather than crediting on a wrong figure.
      const amountMismatch =
        nextStatus === TX_STATUS.MATCHED &&
        remote.amount !== undefined &&
        remote.amount !== null &&
        tx.amount_kes !== null &&
        Math.abs(Number(remote.amount) - Number(tx.amount_kes)) > 0.01;
      if (amountMismatch) {
        this.logger.error(
          `Pesapal amount mismatch on tx ${tx.id}: expected ${tx.amount_kes}, reported ${remote.amount} — holding for manual reconcile`,
        );
        nextStatus = TX_STATUS.PENDING;
      }

      const { error } = await this.db
        .from('pesapal_transactions')
        .update({
          status: nextStatus,
          method: remote.payment_method ?? tx.method,
          // Never overwrite the authoritative charge amount; keep the
          // provider-reported figure in `raw` for the audit trail.
          raw: {
            ...(tx.raw ?? {}),
            stage: 'status',
            status_code: code,
            payment_status_description: desc,
            confirmation_code: remote.confirmation_code ?? null,
            provider_reported_amount: remote.amount ?? null,
            amount_mismatch: amountMismatch || undefined,
          },
        })
        .eq('id', tx.id);
      if (error) {
        this.logger.error(`Failed to update Pesapal tx: ${error.message}`);
      }

      if (nextStatus === TX_STATUS.MATCHED && tx.order_id) {
        await this.creditOrder(
          tx.order_id,
          'pesapal',
          remote.confirmation_code ?? tx.pesapal_order_id,
        );
      }
    }

    return {
      orderTrackingId: tx.pesapal_order_id,
      paymentStatusDescription: desc,
      statusCode: code,
      status: nextStatus,
      orderId: tx.order_id,
      paid: nextStatus === TX_STATUS.MATCHED,
    };
  }

  // ───────────────────────── Admin ───────────────────────────────────────

  /**
   * Unified, paginated list of M-Pesa + Pesapal transactions (admin only).
   * Merges both tables in memory across the requested page window — fine at the
   * expected transaction volumes; revisit with a SQL view/union if it grows.
   */
  async adminListPayments(
    query: AdminListPaymentsQueryDto,
  ): Promise<PaginatedPayments<AdminPaymentView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const wantMpesa = !query.provider || query.provider === PaymentProviderFilter.MPESA;
    const wantPesapal = !query.provider || query.provider === PaymentProviderFilter.PESAPAL;

    const collected: AdminPaymentView[] = [];

    if (wantMpesa) {
      let q = this.db
        .from('mpesa_transactions')
        .select(
          'id, mpesa_ref, amount_kes, customer_phone, order_id, status, received_at, order:orders!order_id(order_number)',
        );
      if (query.status) q = q.eq('status', query.status);
      if (query.orderId) q = q.eq('order_id', query.orderId);
      const { data, error } = await q.order('received_at', { ascending: false }).limit(500);
      if (error) throw new BadRequestException(error.message);
      for (const r of (data ?? []) as unknown as (MpesaTxRow & {
        order: { order_number: string } | null;
      })[]) {
        collected.push({
          id: r.id,
          provider: 'mpesa',
          reference: r.mpesa_ref,
          amountKes: r.amount_kes,
          status: r.status,
          orderId: r.order_id,
          orderNumber: r.order?.order_number ?? null,
          customerPhone: r.customer_phone,
          method: 'mpesa',
          receivedAt: r.received_at,
        });
      }
    }

    if (wantPesapal) {
      let q = this.db
        .from('pesapal_transactions')
        .select(
          'id, pesapal_order_id, amount_kes, method, order_id, status, received_at, order:orders!order_id(order_number)',
        );
      if (query.status) q = q.eq('status', query.status);
      if (query.orderId) q = q.eq('order_id', query.orderId);
      const { data, error } = await q.order('received_at', { ascending: false }).limit(500);
      if (error) throw new BadRequestException(error.message);
      for (const r of (data ?? []) as unknown as (PesapalTxRow & {
        order: { order_number: string } | null;
      })[]) {
        collected.push({
          id: r.id,
          provider: 'pesapal',
          reference: r.pesapal_order_id,
          amountKes: r.amount_kes,
          status: r.status ?? TX_STATUS.PENDING,
          orderId: r.order_id,
          orderNumber: r.order?.order_number ?? null,
          customerPhone: null,
          method: r.method,
          receivedAt: r.received_at,
        });
      }
    }

    collected.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    const total = collected.length;
    const start = (page - 1) * pageSize;
    const items = collected.slice(start, start + pageSize);

    return { items, page, pageSize, total };
  }

  /**
   * Re-query the provider for a transaction by its PK and reconcile both the
   * transaction and (on success) its order. Addresses MISSING_FEATURES A-2/P-6.
   */
  async adminReconcile(
    transactionId: string,
    provider: ReconcileProvider,
  ): Promise<ReconcileResult> {
    if (provider === ReconcileProvider.MPESA) {
      const { data, error } = await this.db
        .from('mpesa_transactions')
        .select('id, mpesa_ref, amount_kes, customer_phone, order_id, raw, status, received_at')
        .eq('id', transactionId)
        .maybeSingle();
      if (error) throw new BadRequestException(error.message);
      if (!data) throw new NotFoundException('M-Pesa transaction not found.');
      const tx = data as MpesaTxRow;
      const previousStatus = tx.status;

      // The CheckoutRequestID lives in raw; if absent (already swapped to a
      // receipt) we can't re-query, so report the stored state.
      const checkoutId = (tx.raw?.CheckoutRequestID as string | undefined) ?? null;
      if (!checkoutId) {
        return {
          provider: 'mpesa',
          transactionId: tx.id,
          previousStatus,
          status: tx.status,
          orderId: tx.order_id,
          orderMarkedPaid: tx.status === TX_STATUS.MATCHED,
          changed: false,
          detail: 'No CheckoutRequestID stored to re-query; transaction already resolved.',
        };
      }

      const result = await this.mpesa.stkQuery(checkoutId);
      const resultCode = result.ResultCode !== undefined ? Number(result.ResultCode) : null;

      if (resultCode === null) {
        return {
          provider: 'mpesa',
          transactionId: tx.id,
          previousStatus,
          status: tx.status,
          orderId: tx.order_id,
          orderMarkedPaid: tx.status === TX_STATUS.MATCHED,
          changed: false,
          detail: `Daraja has no final result yet: ${result.ResultDesc ?? 'pending'}`,
        };
      }

      if (resultCode === 0) {
        await this.applyMpesaSuccess(tx, {
          ResultCode: 0,
          ResultDesc: result.ResultDesc,
          source: 'reconcile',
        });
      } else if (!FINAL_TX_STATUSES.includes(tx.status)) {
        await this.markMpesaFailed(tx, resultCode, result.ResultDesc ?? null, {
          source: 'reconcile',
        });
      }

      const fresh = (await this.findMpesaTxByCheckout(checkoutId)) ?? tx;
      return {
        provider: 'mpesa',
        transactionId: tx.id,
        previousStatus,
        status: fresh.status,
        orderId: fresh.order_id,
        orderMarkedPaid: fresh.status === TX_STATUS.MATCHED,
        changed: fresh.status !== previousStatus,
        detail: result.ResultDesc ?? `ResultCode ${resultCode}`,
      };
    }

    // Pesapal
    const { data, error } = await this.db
      .from('pesapal_transactions')
      .select('id, pesapal_order_id, amount_kes, method, order_id, raw, status, received_at')
      .eq('id', transactionId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Pesapal transaction not found.');
    const tx = data as PesapalTxRow;
    const previousStatus = tx.status ?? TX_STATUS.PENDING;

    const view = await this.reconcilePesapal(tx);
    return {
      provider: 'pesapal',
      transactionId: tx.id,
      previousStatus,
      status: view.status,
      orderId: view.orderId,
      orderMarkedPaid: view.paid,
      changed: view.status !== previousStatus,
      detail: view.paymentStatusDescription ?? `status_code ${view.statusCode}`,
    };
  }

  /**
   * Manually link an unmatched provider transaction to an order (by order
   * number) and credit it. For admin resolution of orphan payments the
   * automatic reconcile couldn't tie to an order. Idempotent on the credit.
   */
  async adminLinkPayment(
    transactionId: string,
    provider: ReconcileProvider,
    orderNumber: string,
  ): Promise<ReconcileResult> {
    const { data: orderRow, error: orderErr } = await this.db
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber.trim())
      .maybeSingle();
    if (orderErr) throw new BadRequestException(orderErr.message);
    if (!orderRow) {
      throw new NotFoundException(`Order "${orderNumber}" not found.`);
    }
    const orderId = (orderRow as { id: string }).id;

    if (provider === ReconcileProvider.MPESA) {
      const tx = await this.db
        .from('mpesa_transactions')
        .select('id, mpesa_ref, status')
        .eq('id', transactionId)
        .maybeSingle();
      if (tx.error) throw new BadRequestException(tx.error.message);
      if (!tx.data) throw new NotFoundException('M-Pesa transaction not found.');
      const row = tx.data as { id: string; mpesa_ref: string; status: string };
      const previousStatus = row.status;

      const { error: upErr } = await this.db
        .from('mpesa_transactions')
        .update({ order_id: orderId, status: TX_STATUS.MATCHED })
        .eq('id', transactionId);
      if (upErr) throw new BadRequestException(upErr.message);

      await this.creditOrder(orderId, 'mpesa', row.mpesa_ref);

      return {
        provider: 'mpesa',
        transactionId,
        previousStatus,
        status: TX_STATUS.MATCHED,
        orderId,
        orderMarkedPaid: true,
        changed: previousStatus !== TX_STATUS.MATCHED,
        detail: `Linked to order ${orderNumber}.`,
      };
    }

    // Pesapal
    const tx = await this.db
      .from('pesapal_transactions')
      .select('id, pesapal_order_id, status')
      .eq('id', transactionId)
      .maybeSingle();
    if (tx.error) throw new BadRequestException(tx.error.message);
    if (!tx.data) throw new NotFoundException('Pesapal transaction not found.');
    const row = tx.data as {
      id: string;
      pesapal_order_id: string;
      status: string | null;
    };
    const previousStatus = row.status ?? TX_STATUS.PENDING;

    const { error: upErr } = await this.db
      .from('pesapal_transactions')
      .update({ order_id: orderId, status: TX_STATUS.MATCHED })
      .eq('id', transactionId);
    if (upErr) throw new BadRequestException(upErr.message);

    await this.creditOrder(orderId, 'pesapal', row.pesapal_order_id);

    return {
      provider: 'pesapal',
      transactionId,
      previousStatus,
      status: TX_STATUS.MATCHED,
      orderId,
      orderMarkedPaid: true,
      changed: previousStatus !== TX_STATUS.MATCHED,
      detail: `Linked to order ${orderNumber}.`,
    };
  }

  // ───────────────────────── Shared helpers ──────────────────────────────

  /**
   * Resolve an order and verify it belongs to the JWT caller. Returns the order
   * plus the customer contact for notifications. Throws 404 if missing, 403 if
   * it belongs to a different customer.
   */
  private async resolveOwnedOrder(
    authUserId: string,
    orderId: string,
  ): Promise<{ order: OrderRow; customer: CustomerContact | null }> {
    const { data: customer, error: custErr } = await this.db
      .from('customers')
      .select('id, email, full_name, phone')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (custErr) throw new BadRequestException(custErr.message);
    if (!customer) {
      throw new NotFoundException('No customer profile for the current user.');
    }

    const { data: order, error: orderErr } = await this.db
      .from('orders')
      .select('id, order_number, customer_id, total_kes, status, payment_status, payment_method')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr) throw new BadRequestException(orderErr.message);
    if (!order) throw new NotFoundException('Order not found.');

    if ((order as OrderRow).customer_id !== (customer as CustomerContact).id) {
      throw new ForbiddenException('This order does not belong to you.');
    }

    return {
      order: order as OrderRow,
      customer: customer as CustomerContact,
    };
  }

  /** Reject orders that are already paid or not in a payable state. */
  private assertPayable(order: OrderRow): void {
    if (order.payment_status === 'paid') {
      throw new ConflictException('This order has already been paid.');
    }
    if (order.status !== 'pending_payment') {
      throw new ConflictException(`Order is not awaiting payment (status: ${order.status}).`);
    }
    if (!(order.total_kes > 0)) {
      throw new BadRequestException('Order total must be greater than zero.');
    }
  }

  /**
   * Credit a paid order: set `payment_status='paid'`, advance `status` to
   * `processing`, stamp the provider reference. IDEMPOTENT — a guarded update
   * (`.neq('payment_status','paid')`) ensures we never double-apply, and the
   * confirmation only fires when this call actually transitioned the row.
   */
  private async creditOrder(
    orderId: string,
    provider: 'mpesa' | 'pesapal',
    reference: string,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      payment_status: 'paid',
      status: 'processing',
      payment_method: provider,
    };
    if (provider === 'mpesa') patch.mpesa_ref = reference;
    else patch.pesapal_id = reference;

    const { data, error } = await this.db
      .from('orders')
      .update(patch)
      .eq('id', orderId)
      .neq('payment_status', 'paid') // idempotency guard: only transition once
      .select('id, order_number, customer_id, total_kes, status, payment_status');
    if (error) {
      this.logger.error(`Failed to credit order ${orderId} (${provider}): ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      // Already paid by a prior callback — nothing more to do (no double SMS).
      this.logger.log(`Order ${orderId} already paid; skipping re-credit.`);
      return;
    }

    const order = data[0] as {
      id: string;
      order_number: string;
      customer_id: string | null;
      total_kes: number;
    };
    await this.sendPaymentConfirmation(order, provider, reference);
  }

  /** Best-effort SMS + email payment confirmation. Never throws. */
  private async sendPaymentConfirmation(
    order: { order_number: string; customer_id: string | null; total_kes: number },
    provider: 'mpesa' | 'pesapal',
    reference: string,
  ): Promise<void> {
    try {
      if (!order.customer_id) return;
      const { data: customer } = await this.db
        .from('customers')
        .select('email, phone')
        .eq('id', order.customer_id)
        .maybeSingle();
      const contact = customer as { email: string | null; phone: string | null } | null;

      const summary = `Order ${order.order_number} • KES ${Number(order.total_kes).toFixed(2)}`;
      const providerLabel = provider === 'mpesa' ? 'M-Pesa' : 'Pesapal';

      if (contact?.email) {
        await this.email.sendEmail({
          to: contact.email,
          subject: `Optex payment received — ${order.order_number}`,
          text: `Payment confirmed via ${providerLabel}. ${summary}. Ref: ${reference}. Your order is now being processed. Asante!`,
          html: `<h2>Payment received</h2><p>${summary}</p><p>Method: ${providerLabel}<br/>Reference: <strong>${reference}</strong></p><p>Your order is now being processed.</p>`,
        });
      }
      if (contact?.phone) {
        await this.sms.sendSms(
          contact.phone,
          `Optex: payment received for ${summary} via ${providerLabel}. Ref ${reference}. Your order is being processed. Asante!`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Payment confirmation failed for ${order.order_number}: ${(e as Error).message}`,
      );
    }
  }

  // ─── Transaction lookups ───

  private async findMpesaTxByCheckout(checkoutRequestId: string): Promise<MpesaTxRow | null> {
    // The CheckoutRequestID is stored both as `mpesa_ref` (pre-receipt) and in
    // `raw.CheckoutRequestID`. Match either so we find the row before AND after
    // the receipt swap.
    //
    // This used to be a single `.or()` built by interpolating the id straight
    // into PostgREST's filter grammar, where a comma or a dot starts a new
    // clause — so a crafted id could rewrite the filter and select a row that
    // was never its own. DTO validation was not a fix on its own: the hot path
    // here is handleMpesaCallback, whose body arrives as `unknown` from a
    // public unauthenticated webhook and never passes through a DTO.
    //
    // Two guards, because either alone is thin:
    //   1. reject anything outside Daraja's id charset outright, and
    //   2. use `.eq()` for both lookups, whose values the client encodes as
    //      parameters, so there is no filter grammar left to escape.
    if (!MPESA_CHECKOUT_ID_RE.test(checkoutRequestId)) {
      this.logger.warn(
        `Rejected malformed CheckoutRequestID in M-Pesa tx lookup: ${JSON.stringify(checkoutRequestId).slice(0, 120)}`,
      );
      return null;
    }

    const columns = 'id, mpesa_ref, amount_kes, customer_phone, order_id, raw, status, received_at';

    for (const column of ['mpesa_ref', 'raw->>CheckoutRequestID'] as const) {
      const { data, error } = await this.db
        .from('mpesa_transactions')
        .select(columns)
        .eq(column, checkoutRequestId)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        this.logger.error(`M-Pesa tx lookup failed on ${column}: ${error.message}`);
        return null;
      }
      if (data) return data as MpesaTxRow;
    }
    return null;
  }

  private async findPesapalTx(orderTrackingId: string): Promise<PesapalTxRow | null> {
    const { data, error } = await this.db
      .from('pesapal_transactions')
      .select('id, pesapal_order_id, amount_kes, method, order_id, raw, status, received_at')
      .eq('pesapal_order_id', orderTrackingId)
      .maybeSingle();
    if (error) {
      this.logger.error(`Pesapal tx lookup failed: ${error.message}`);
      return null;
    }
    return (data as PesapalTxRow | null) ?? null;
  }

  // ─── Daraja callback parsing ───

  /** Pull `Body.stkCallback` out of an arbitrary Daraja callback payload. */
  private extractStkCallback(body: unknown): StkCallback | null {
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, unknown>;
    const outer = (b.Body ?? b.body) as Record<string, unknown> | undefined;
    const stk = (outer?.stkCallback ?? b.stkCallback) as Record<string, unknown> | undefined;
    if (!stk) return null;
    return stk as StkCallback;
  }

  /** Flatten Daraja's CallbackMetadata.Item[] {Name,Value} list to an object. */
  private extractCallbackMetadata(
    metadata: { Item?: { Name: string; Value?: unknown }[] } | undefined,
  ): {
    MpesaReceiptNumber?: string;
    Amount?: number;
    PhoneNumber?: string;
    TransactionDate?: string;
  } {
    const out: Record<string, unknown> = {};
    for (const item of metadata?.Item ?? []) {
      if (item && item.Name !== undefined) {
        out[item.Name] = item.Value;
      }
    }
    return {
      MpesaReceiptNumber: out.MpesaReceiptNumber as string | undefined,
      Amount: out.Amount as number | undefined,
      PhoneNumber: out.PhoneNumber as string | undefined,
      TransactionDate: out.TransactionDate as string | undefined,
    };
  }
  /**
   * Money that needs a human — SPEC-06 R5 and R7.
   *
   * Two situations the system deliberately does not act on, and so would
   * otherwise sit invisible:
   *
   *   paidAndCancelled  the customer paid and the order was then cancelled.
   *                     Client policy is "no refunds", so nothing is refunded
   *                     automatically and nothing ever calls a provider — but
   *                     somebody has to decide what happens to that money, and
   *                     they can only decide if they can see it (R5).
   *
   *   reversed          the provider reversed a transaction. The system already
   *                     records the status and then does nothing with it (H5:
   *                     the admin handles reversals manually), which means
   *                     today it is recorded and forgotten (R7).
   *
   * Read-only by design. Surfacing is the whole feature; no automated action is
   * taken on either group.
   */
  async adminPaymentsNeedingAttention(): Promise<{
    paidAndCancelled: {
      orderId: string;
      orderNumber: string;
      totalKes: number;
      paymentMethod: string | null;
      updatedAt: string | null;
    }[];
    reversed: {
      id: string;
      provider: 'mpesa' | 'pesapal';
      reference: string | null;
      amountKes: number | null;
      orderId: string | null;
      orderNumber: string | null;
      receivedAt: string;
    }[];
  }> {
    const unwrap = <T>(embed: T | T[] | null): T | null =>
      Array.isArray(embed) ? (embed[0] ?? null) : embed;

    const { data: cancelledPaid, error: ordersError } = await this.db
      .from('orders')
      .select('id, order_number, total_kes, payment_method, updated_at')
      .eq('payment_status', 'paid')
      .eq('status', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (ordersError) {
      this.logger.error(`Could not load paid+cancelled orders: ${ordersError.message}`);
      throw new InternalServerErrorException('Could not load payments needing attention.');
    }

    const [mpesa, pesapal] = await Promise.all([
      this.db
        .from('mpesa_transactions')
        .select(
          'id, mpesa_ref, amount_kes, order_id, received_at, order:orders!order_id(order_number)',
        )
        .eq('status', TX_STATUS.REVERSED)
        .order('received_at', { ascending: false })
        .limit(200),
      this.db
        .from('pesapal_transactions')
        .select(
          'id, pesapal_order_id, amount_kes, order_id, received_at, order:orders!order_id(order_number)',
        )
        .eq('status', TX_STATUS.REVERSED)
        .order('received_at', { ascending: false })
        .limit(200),
    ]);

    const reversed = [
      ...((mpesa.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        provider: 'mpesa' as const,
        reference: (r.mpesa_ref as string) ?? null,
        amountKes: (r.amount_kes as number) ?? null,
        orderId: (r.order_id as string) ?? null,
        orderNumber: unwrap(r.order as { order_number: string } | null)?.order_number ?? null,
        receivedAt: r.received_at as string,
      })),
      ...((pesapal.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        provider: 'pesapal' as const,
        reference: (r.pesapal_order_id as string) ?? null,
        amountKes: (r.amount_kes as number) ?? null,
        orderId: (r.order_id as string) ?? null,
        orderNumber: unwrap(r.order as { order_number: string } | null)?.order_number ?? null,
        receivedAt: r.received_at as string,
      })),
    ].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

    return {
      paidAndCancelled: (cancelledPaid ?? []).map((o) => ({
        orderId: o.id as string,
        orderNumber: o.order_number as string,
        totalKes: o.total_kes as number,
        paymentMethod: (o.payment_method as string) ?? null,
        updatedAt: (o.updated_at as string) ?? null,
      })),
      reversed,
    };
  }
}
