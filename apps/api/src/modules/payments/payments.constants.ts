/**
 * Shared constants + small helpers for the PAYMENTS module.
 *
 * Base URLs are picked by `NODE_ENV`: anything other than `production` uses the
 * providers' sandbox hosts so dev/test never hit live money rails.
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
