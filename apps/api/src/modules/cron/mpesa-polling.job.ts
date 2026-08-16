import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { MpesaService } from '../payments/mpesa.service';
import { FINAL_TX_STATUSES, TX_STATUS } from '../payments/payments.constants';
import { ReconcileProvider } from '../payments/dto/reconcile-payment.dto';
import { CronLeaseService } from './cron-lease.service';

/**
 * Minimal `mpesa_transactions` row shape we need to decide whether a row is
 * still pollable. Mirrors migration 0001 + `database.types`.
 */
interface PendingMpesaTxRow {
  id: string;
  status: string;
  received_at: string;
  /** CheckoutRequestID lives in `raw` — `adminReconcile` re-queries Daraja with it. */
  raw: Record<string, unknown> | null;
}

/** Skip transactions younger than this — give Daraja's own callback a chance first. */
const MIN_AGE_MS = 60_000; // 1 minute
/** Give up on transactions older than this — a callback/manual recon will own them. */
const MAX_AGE_MS = 60 * 60_000; // 60 minutes

/**
 * CRON · M-PESA STATUS POLLING (fixes MISSING_FEATURES P-4).
 *
 * Daraja's STK callback is best-effort and frequently lost (NAT, transient 5xx,
 * cold callback URL). Without a poll, a customer who paid can be left with an
 * order stuck in `pending_payment` forever. This job is the safety net: every
 * ~2 minutes it sweeps `mpesa_transactions` still in `pending`, re-queries
 * Daraja, and reconciles the transaction + its order.
 *
 * REUSE: it does NOT duplicate any credit/reconcile logic. It calls
 * {@link PaymentsService.adminReconcileImpl} — the same reconcile logic the
 * admin "reconcile" button uses via `adminReconcile()`, minus that method's
 * audit-log wrapper (this is a system/cron action, not a human admin one) —
 * which re-queries Daraja via the stored `raw.CheckoutRequestID`, idempotently
 * marks the tx `matched`/`failed`, and (on success) credits the order via the
 * guarded `payment_status != 'paid'`
 * update. Double-crediting is therefore impossible even if a callback lands at
 * the same time.
 *
 * MISSING-CREDS: if M-Pesa isn't configured the provider throws
 * `ServiceUnavailableException`; we short-circuit on `isConfigured()` (and also
 * catch the exception defensively) and skip the whole run quietly at debug.
 *
 * SAFETY: never throws — a thrown cron job is just noise. Each transaction is
 * isolated in its own try/catch so one bad row can't abort the sweep.
 */
@Injectable()
export class MpesaPollingJob {
  private readonly logger = new Logger(MpesaPollingJob.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly payments: PaymentsService,
    private readonly mpesa: MpesaService,
    private readonly lease: CronLeaseService,
  ) {}

  private get db() {
    return this.supabase.client;
  }

  // Every 2 minutes (no CronExpression preset exists for this interval).
  @Cron('0 */2 * * * *', { name: 'mpesa-status-polling' })
  async pollPendingTransactions(): Promise<void> {
    // Cheapest possible early-out: don't hit the DB if M-Pesa is unconfigured.
    if (!this.mpesa.isConfigured()) {
      this.logger.debug('M-Pesa not configured — skipping STK polling run.');
      return;
    }

    // F-05: one runner across replicas. `adminReconcile` is idempotent, so a
    // duplicate run cannot double-credit — but it would double the Daraja
    // queries, and Daraja rate-limits.
    if (!(await this.lease.claim('mpesa-status-polling', 110))) {
      return;
    }

    const now = Date.now();
    const newestEligible = new Date(now - MIN_AGE_MS).toISOString();
    const oldestEligible = new Date(now - MAX_AGE_MS).toISOString();

    let rows: PendingMpesaTxRow[];
    try {
      const { data, error } = await this.db
        .from('mpesa_transactions')
        .select('id, status, received_at, raw')
        // Still open (PENDING). FINAL statuses are excluded explicitly too in
        // case the column ever carries a legacy 'unmatched' default.
        .eq('status', TX_STATUS.PENDING)
        .lte('received_at', newestEligible) // skip brand-new (callback may still arrive)
        .gte('received_at', oldestEligible) // give up on very old
        .order('received_at', { ascending: true })
        .limit(50);
      if (error) {
        this.logger.error(`Failed to load pending M-Pesa txns: ${error.message}`);
        return;
      }
      rows = (data ?? []) as PendingMpesaTxRow[];
    } catch (err) {
      this.logger.error(`M-Pesa polling query threw: ${(err as Error).message}`);
      return;
    }

    if (rows.length === 0) {
      this.logger.debug('No pending M-Pesa transactions to poll.');
      return;
    }

    let reconciled = 0;
    let matched = 0;

    for (const tx of rows) {
      // Defensive: never re-touch a final row.
      if (FINAL_TX_STATUSES.includes(tx.status)) continue;
      // `adminReconcile` needs the CheckoutRequestID from `raw` to re-query;
      // without it Daraja can't be polled, so skip (a callback/manual recon
      // owns these). This mirrors the no-op branch inside `adminReconcile`.
      if (!tx.raw || typeof tx.raw.CheckoutRequestID !== 'string') {
        continue;
      }

      try {
        // adminReconcileImpl, not adminReconcile — this is a system/cron
        // action with no human admin to attribute an audit_log entry to.
        const result = await this.payments.adminReconcileImpl(tx.id, ReconcileProvider.MPESA);
        if (result.changed) {
          reconciled += 1;
          if (result.status === TX_STATUS.MATCHED) matched += 1;
        }
      } catch (err) {
        // If creds vanished mid-run (rotated/cleared), the provider throws
        // ServiceUnavailableException — abandon the whole run quietly rather
        // than hammering Daraja per-row.
        if (err instanceof ServiceUnavailableException) {
          this.logger.debug(`M-Pesa unavailable mid-run — aborting STK polling: ${err.message}`);
          return;
        }
        // Any other per-row failure (network blip, bad row) — log and move on.
        this.logger.warn(`Failed to reconcile M-Pesa tx ${tx.id}: ${(err as Error).message}`);
      }
    }

    if (reconciled > 0) {
      this.logger.log(
        `M-Pesa polling: scanned ${rows.length}, reconciled ${reconciled} (${matched} now paid).`,
      );
    } else {
      this.logger.debug(`M-Pesa polling: scanned ${rows.length}, none resolved this run.`);
    }
  }
}
