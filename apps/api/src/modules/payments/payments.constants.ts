/**
 * Shared constants + small helpers for the PAYMENTS module.
 *
 * Base URLs are picked by `providerEnvironment()`: by default anything other
 * than `NODE_ENV=production` uses the providers' sandbox hosts so dev/test never
 * hit live money rails, and `MPESA_ENV` / `PESAPAL_ENV` can pin either one.
 */

/** Daraja (M-Pesa) base URLs. */
export const MPESA_BASE_URL = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
} as const;

/** Pesapal v3 base URLs. */
export const PESAPAL_BASE_URL = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  production: 'https://pay.pesapal.com/v3',
} as const;

/** Resolve the provider host for the current environment. */
export function isProd(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

/** Which of a provider's two hosts to call. */
export type ProviderEnvironment = 'sandbox' | 'production';

/**
 * Picks a payment provider's host. An explicit `MPESA_ENV` / `PESAPAL_ENV`
 * wins; unset, it follows `NODE_ENV` as it always has.
 *
 * The override is for the testing phase: a deployment has to run with
 * `NODE_ENV=production` (structured logs, Swagger off, the production env
 * checks) but should only ever take sandbox payments. It must be removed before
 * go-live — in sandbox mode an order the provider confirms has not been paid.
 */
export function providerEnvironment(
  nodeEnv: string | undefined,
  override: ProviderEnvironment | undefined,
): ProviderEnvironment {
  return override ?? (isProd(nodeEnv) ? 'production' : 'sandbox');
}

/** Logged at start-up when a production deployment is pinned to a sandbox. */
export function sandboxInProductionWarning(provider: 'M-Pesa' | 'Pesapal', envVar: string): string {
  return (
    `${provider} is using its SANDBOX in production (${envVar}=sandbox): no real money moves, ` +
    `yet orders it confirms are marked paid. Remove ${envVar} before go-live.`
  );
}

/**
 * `mpesa_transactions.status` / `pesapal_transactions.status` are free-text
 * columns (not enums). We use a small controlled vocabulary so reconciliation
 * and idempotency checks are unambiguous. `received_at` is the only timestamp;
 * the lifecycle lives in `status`.
 *
 * - `pending`   — STK push sent / order submitted, awaiting provider callback.
 * - `matched`   — provider confirmed success; order marked paid.
 * - `failed`    — provider reported a non-zero result / failed payment.
 * - `reversed`  — a previously-successful charge was reversed/refunded.
 *
 * `matched`, `failed`, and `reversed` are FINAL for idempotency purposes.
 */
export const TX_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const;

export type TxStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS];

/** Statuses that are terminal — an idempotent webhook must not re-apply them. */
export const FINAL_TX_STATUSES: readonly string[] = [
  TX_STATUS.MATCHED,
  TX_STATUS.FAILED,
  TX_STATUS.REVERSED,
];

/** Daraja STK timestamp: `YYYYMMDDHHmmss` in the server's local time. */
export function darajaTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}` +
    `${pad(d.getMonth() + 1)}` +
    `${pad(d.getDate())}` +
    `${pad(d.getHours())}` +
    `${pad(d.getMinutes())}` +
    `${pad(d.getSeconds())}`
  );
}

/**
 * Normalize a Kenyan MSISDN to the `2547XXXXXXXX` / `2541XXXXXXXX` form Daraja
 * expects. Accepts `07XXXXXXXX`, `+2547XXXXXXXX`, `2547XXXXXXXX`, `7XXXXXXXX`.
 * Returns `null` if it can't be coerced into a plausible 12-digit MSISDN.
 */
export function normalizeKenyanMsisdn(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;

  let msisdn = digits;
  if (msisdn.startsWith('0')) {
    msisdn = `254${msisdn.slice(1)}`;
  } else if (msisdn.startsWith('254')) {
    // already in international form
  } else if (msisdn.length === 9 && (msisdn.startsWith('7') || msisdn.startsWith('1'))) {
    msisdn = `254${msisdn}`;
  } else if (msisdn.startsWith('+254')) {
    msisdn = msisdn.slice(1);
  }

  // Final shape: 254 + 9 digits = 12 digits, second char 7 or 1.
  if (/^254[71]\d{8}$/.test(msisdn)) {
    return msisdn;
  }
  return null;
}

/**
 * How many distinct phone numbers a single order may send an STK push to
 * (audit A-03). Three covers paying from your own line, then a relative's when
 * the first has no float — and stops an unpaid order being used as a way to
 * ring arbitrary handsets.
 */
export const MAX_STK_DESTINATIONS_PER_ORDER = 3;

// ── Concurrent-attempt guard (SPEC-11 B-7, migration 0042) ───────────────────

/**
 * How long one payment attempt holds an order against a second (SPEC-11 B-7).
 *
 * Roughly a minute is how long Safaricom keeps an STK prompt answerable on the
 * handset, so 90s covers it with margin. The same number bounds an UNRECORDED
 * claim — one whose process died mid-call simply expires after this long.
 *
 * Passed to `claim_payment_attempt`, whose own default is the same 90.
 */
export const PAYMENT_ATTEMPT_WINDOW_SECONDS = 90;

/**
 * Hard ceilings on the provider calls made while an order is claimed.
 *
 * These exist to hold one invariant: a request must never outlive its own
 * claim. `fetch` has no overall timeout by default, so a hung provider call
 * could otherwise finish AFTER the claim expired and a second request had
 * pushed — exactly the double prompt the claim is there to prevent.
 *
 * Deliberately generous for the submit call. Cutting a slow-but-successful STK
 * push short is worse than waiting for it: the prompt still reaches the handset,
 * the customer pays, and the callback then names a CheckoutRequestID we never
 * recorded. The sum (35s) stays well inside `PAYMENT_ATTEMPT_WINDOW_SECONDS`;
 * a unit test asserts it.
 */
export const PROVIDER_AUTH_TIMEOUT_MS = 10_000;
export const PROVIDER_SUBMIT_TIMEOUT_MS = 25_000;

/**
 * How long a second request waits for a first one that is still talking to the
 * provider, before giving up with a 409.
 *
 * Waiting rather than refusing is what makes concurrent duplicates idempotent:
 * a double tap, or an app retry after its own timeout while the server is still
 * working, ends with both callers holding the SAME CheckoutRequestID instead of
 * one of them holding an error for a payment that is in fact live. Kept short —
 * mobile clients time a request out at 30s.
 */
export const ATTEMPT_WAIT_MS = 8_000;
export const ATTEMPT_POLL_MS = 600;
