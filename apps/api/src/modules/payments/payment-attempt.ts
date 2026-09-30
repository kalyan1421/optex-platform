/**
 * Decision logic for the concurrent-payment-attempt guard (SPEC-11 B-7,
 * migration 0042).
 *
 * `claim_payment_attempt` decides, atomically, whether an order is free to take
 * a payment attempt. This module is the other half: given what it said, what
 * does the API do? Kept pure — no I/O — so the rules, and above all the
 * customer-facing wording, are unit-testable without a database.
 *
 * THE RULE
 *   An order has at most one live attempt at a time, across both rails. A second
 *   request is either
 *     - a REPLAY of the live attempt (same rail, same destination), answered
 *       with the attempt that already exists — so a double tap or a retry after
 *       a client timeout is idempotent and never puts a second prompt on a
 *       handset; or
 *     - a CONFLICT (a different phone, or the other rail), refused with a
 *       message a customer can act on.
 */

import type { MpesaStkPushResult, PesapalInitiateResult } from './dto/payment-views';

export type PaymentRail = 'mpesa' | 'pesapal';

/** A claim that was refused because a recorded attempt has not resolved yet. */
export interface LiveAttempt {
  claimed: false;
  reason: 'live_attempt';
  provider: PaymentRail;
  ref: string;
  /** M-Pesa only — the MSISDN the live prompt went to. */
  phone: string | null;
  raw: Record<string, unknown>;
  retryAfterSeconds: number;
}

/** A claim that was refused because another request is still talking to the provider. */
export interface InFlightAttempt {
  claimed: false;
  reason: 'in_flight';
  retryAfterSeconds: number;
}

/** What `claim_payment_attempt` returned, validated. */
export type AttemptClaim = { claimed: true } | InFlightAttempt | LiveAttempt;

/** What to do about a refused claim, for a request on one rail. */
export type BlockedOutcome<R> =
  | { kind: 'replay'; result: R }
  | { kind: 'conflict'; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates the RPC payload.
 *
 * Returns `null` for anything that is not a shape this code knows. The caller
 * treats that as an error rather than as "claimed": a payload that has drifted
 * from what the migration returns must never be read as permission to charge.
 */
export function parseAttemptClaim(value: unknown): AttemptClaim | null {
  if (!isRecord(value)) return null;

  if (value.claimed === true) return { claimed: true };
  if (value.claimed !== false) return null;

  const retry = Number(value.retry_after_seconds);
  const retryAfterSeconds = Number.isFinite(retry) && retry >= 1 ? Math.ceil(retry) : 1;

  if (value.reason === 'in_flight') {
    return { claimed: false, reason: 'in_flight', retryAfterSeconds };
  }

  if (value.reason === 'live_attempt') {
    const provider = value.provider;
    if ((provider !== 'mpesa' && provider !== 'pesapal') || typeof value.ref !== 'string') {
      return null;
    }
    return {
      claimed: false,
      reason: 'live_attempt',
      provider,
      ref: value.ref,
      phone: typeof value.phone === 'string' ? value.phone : null,
      raw: isRecord(value.raw) ? value.raw : {},
      retryAfterSeconds,
    };
  }

  return null;
}

/** `2 seconds`, `1 second` — a wait is always at least one. */
function seconds(n: number): string {
  const s = Math.max(1, Math.ceil(n));
  return `${s} second${s === 1 ? '' : 's'}`;
}

/**
 * Enough of a number for the customer to recognise it, not enough to disclose
 * it. The response only ever goes to the order's owner, but a message is also
 * logged and screenshotted.
 */
export function maskPhone(msisdn: string | null): string {
  const digits = (msisdn ?? '').replace(/\D/g, '');
  return digits.length >= 3 ? `the number ending ${digits.slice(-3)}` : 'another number';
}

function strField(raw: Record<string, unknown>, key: string): string | null {
  const v = raw[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * A request for an M-Pesa prompt, against a live attempt.
 *
 * Same destination: this is the prompt the customer is already looking at, so
 * answer with it rather than sending another — they poll the same
 * CheckoutRequestID either way.
 */
export function classifyMpesaAttempt(
  claim: LiveAttempt,
  phone: string,
): BlockedOutcome<MpesaStkPushResult> {
  const wait = seconds(claim.retryAfterSeconds);

  if (claim.provider === 'mpesa') {
    if (claim.phone === phone) {
      return {
        kind: 'replay',
        result: {
          checkoutRequestId: strField(claim.raw, 'CheckoutRequestID') ?? claim.ref,
          merchantRequestId: strField(claim.raw, 'MerchantRequestID'),
          message:
            'We already sent an M-Pesa prompt to this number a moment ago. ' +
            'Enter your M-Pesa PIN on your phone to complete payment.',
        },
      };
    }
    return {
      kind: 'conflict',
      message:
        `An M-Pesa prompt for this order is already waiting on ${maskPhone(claim.phone)}. ` +
        `Approve or decline it there, or try again in ${wait}.`,
    };
  }

  // A card session is open. Reachable by switching method mid-payment, which is
  // exactly when a customer is most likely to pay twice.
  return {
    kind: 'conflict',
    message:
      'A card payment for this order was started a moment ago and may still be open. ' +
      `Finish it or close it, then try M-Pesa in ${wait}.`,
  };
}

/** A request for a card session, against a live attempt. */
export function classifyPesapalAttempt(claim: LiveAttempt): BlockedOutcome<PesapalInitiateResult> {
  const wait = seconds(claim.retryAfterSeconds);

  if (claim.provider === 'pesapal') {
    const redirectUrl = strField(claim.raw, 'redirect_url');
    if (redirectUrl) {
      return {
        kind: 'replay',
        result: {
          orderTrackingId: claim.ref,
          redirectUrl,
          message: 'Redirect the customer to complete payment.',
        },
      };
    }
    // A pending session with no URL recorded should not exist. Refusing is the
    // safe reading: the alternative is opening a second session beside it.
    return {
      kind: 'conflict',
      message: `A card payment for this order was only just started. Please try again in ${wait}.`,
    };
  }

  return {
    kind: 'conflict',
    message:
      `An M-Pesa prompt for this order is still waiting on ${maskPhone(claim.phone)}. ` +
      `Approve or decline it there, or choose card in ${wait}.`,
  };
}

/**
 * The wording for a wait that ran out while another request was still setting
 * up. There is no recorded attempt to replay yet, so this is always a refusal.
 */
export function inFlightMessage(retryAfterSeconds: number): string {
  return `Your payment is still being set up. Please try again in ${seconds(retryAfterSeconds)}.`;
}
