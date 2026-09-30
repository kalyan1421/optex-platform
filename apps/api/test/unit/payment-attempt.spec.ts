import {
  type LiveAttempt,
  classifyMpesaAttempt,
  classifyPesapalAttempt,
  inFlightMessage,
  maskPhone,
  parseAttemptClaim,
} from '../../src/modules/payments/payment-attempt';
import {
  ATTEMPT_POLL_MS,
  ATTEMPT_WAIT_MS,
  PAYMENT_ATTEMPT_WINDOW_SECONDS,
  PROVIDER_AUTH_TIMEOUT_MS,
  PROVIDER_SUBMIT_TIMEOUT_MS,
} from '../../src/modules/payments/payments.constants';

/**
 * Unit tests for the concurrent-payment-attempt guard's decision logic
 * (SPEC-11 B-7). The atomic claim itself is proven in
 * `payment-attempt-guard.e2e-spec.ts`, against a real database; what lives here
 * is everything that does not need one — how the RPC's answer is read, and
 * what a customer is told.
 */

const PHONE = '254712345678';

function live(over: Partial<LiveAttempt> = {}): LiveAttempt {
  return {
    claimed: false,
    reason: 'live_attempt',
    provider: 'mpesa',
    ref: 'ws_CO_REF',
    phone: PHONE,
    raw: { CheckoutRequestID: 'ws_CO_RAW', MerchantRequestID: 'mr-1' },
    retryAfterSeconds: 42,
    ...over,
  };
}

describe('parseAttemptClaim', () => {
  it('reads a won claim', () => {
    expect(parseAttemptClaim({ claimed: true })).toEqual({ claimed: true });
  });

  it('reads an in-flight refusal', () => {
    expect(
      parseAttemptClaim({ claimed: false, reason: 'in_flight', retry_after_seconds: 7 }),
    ).toEqual({ claimed: false, reason: 'in_flight', retryAfterSeconds: 7 });
  });

  it('reads a live attempt with everything the caller needs to replay it', () => {
    expect(
      parseAttemptClaim({
        claimed: false,
        reason: 'live_attempt',
        provider: 'pesapal',
        ref: 'pp-1',
        phone: null,
        raw: { redirect_url: 'https://pay.example/x' },
        retry_after_seconds: 30,
      }),
    ).toEqual({
      claimed: false,
      reason: 'live_attempt',
      provider: 'pesapal',
      ref: 'pp-1',
      phone: null,
      raw: { redirect_url: 'https://pay.example/x' },
      retryAfterSeconds: 30,
    });
  });

  // The property that matters most: a payload we do not understand must never
  // be read as permission to charge. `null` makes the caller fail closed.
  it.each([
    ['null', null],
    ['a string', 'claimed'],
    ['an array', [true]],
    ['an empty object', {}],
    ['claimed as the string "true"', { claimed: 'true' }],
    ['claimed as 1', { claimed: 1 }],
    ['a refusal with no reason', { claimed: false }],
    ['an unknown reason', { claimed: false, reason: 'maintenance' }],
    [
      'a live attempt on an unknown rail',
      { claimed: false, reason: 'live_attempt', provider: 'paypal', ref: 'x' },
    ],
    [
      'a live attempt with no reference',
      { claimed: false, reason: 'live_attempt', provider: 'mpesa' },
    ],
    [
      'a live attempt with a non-string reference',
      { claimed: false, reason: 'live_attempt', provider: 'mpesa', ref: 7 },
    ],
  ])('rejects %s', (_label, payload) => {
    expect(parseAttemptClaim(payload)).toBeNull();
  });

  it.each([
    [0, 1],
    [-3, 1],
    [Number.NaN, 1],
    [undefined, 1],
    [2.2, 3],
    [90, 90],
  ])('clamps a retry-after of %s to a whole second of at least %s', (input, expected) => {
    const claim = parseAttemptClaim({
      claimed: false,
      reason: 'in_flight',
      retry_after_seconds: input,
    });
    expect(claim).toMatchObject({ retryAfterSeconds: expected });
  });

  it('treats a missing or non-object raw payload as empty rather than throwing', () => {
    const claim = parseAttemptClaim({
      claimed: false,
      reason: 'live_attempt',
      provider: 'mpesa',
      ref: 'x',
      raw: 'oops',
    });
    expect(claim).toMatchObject({ raw: {} });
  });
});

describe('classifyMpesaAttempt', () => {
  it('answers a repeat request to the same number with the live prompt', () => {
    const out = classifyMpesaAttempt(live(), PHONE);
    expect(out.kind).toBe('replay');
    if (out.kind !== 'replay') return;
    // Prefers the id Daraja gave us over the row's key, which is only a
    // placeholder until a receipt swaps it.
    expect(out.result.checkoutRequestId).toBe('ws_CO_RAW');
    expect(out.result.merchantRequestId).toBe('mr-1');
    expect(out.result.message).toMatch(/already sent/i);
  });

  it('falls back to the row reference when the raw payload has no CheckoutRequestID', () => {
    const out = classifyMpesaAttempt(live({ raw: {} }), PHONE);
    expect(out).toMatchObject({
      kind: 'replay',
      result: { checkoutRequestId: 'ws_CO_REF', merchantRequestId: null },
    });
  });

  it('refuses a different number, saying where the prompt is without giving the number away', () => {
    const out = classifyMpesaAttempt(live(), '254722000111');
    expect(out.kind).toBe('conflict');
    if (out.kind !== 'conflict') return;
    expect(out.message).toContain('ending 678');
    expect(out.message).not.toContain(PHONE);
    expect(out.message).toContain('42 seconds');
  });

  it('refuses while a card session is open, and says how to proceed', () => {
    const out = classifyMpesaAttempt(
      live({ provider: 'pesapal', phone: null, raw: { redirect_url: 'https://pay.example/x' } }),
      PHONE,
    );
    expect(out.kind).toBe('conflict');
    if (out.kind !== 'conflict') return;
    expect(out.message).toMatch(/card payment/i);
    expect(out.message).toContain('42 seconds');
  });
});

describe('classifyPesapalAttempt', () => {
  const session = live({
    provider: 'pesapal',
    ref: 'pp-tracking-1',
    phone: null,
    raw: { redirect_url: 'https://pay.example/session/1' },
  });

  it('answers a repeat request with the open session, not a second one', () => {
    expect(classifyPesapalAttempt(session)).toEqual({
      kind: 'replay',
      result: {
        orderTrackingId: 'pp-tracking-1',
        redirectUrl: 'https://pay.example/session/1',
        message: 'Redirect the customer to complete payment.',
      },
    });
  });

  it('refuses rather than open a second session beside one it cannot describe', () => {
    const out = classifyPesapalAttempt({ ...session, raw: {} });
    expect(out.kind).toBe('conflict');
  });

  it('refuses while an M-Pesa prompt is live, naming where it is', () => {
    const out = classifyPesapalAttempt(live());
    expect(out.kind).toBe('conflict');
    if (out.kind !== 'conflict') return;
    expect(out.message).toContain('ending 678');
    expect(out.message).not.toContain(PHONE);
  });
});

describe('wording', () => {
  it('pluralises the wait', () => {
    expect(inFlightMessage(1)).toContain('1 second.');
    expect(inFlightMessage(2)).toContain('2 seconds.');
  });

  it('never tells a customer to wait zero seconds', () => {
    expect(inFlightMessage(0)).toContain('1 second.');
    expect(classifyMpesaAttempt(live({ retryAfterSeconds: 0 }), '254722000111')).toMatchObject({
      message: expect.stringContaining('1 second'),
    });
  });

  it('masks a number down to its last three digits', () => {
    expect(maskPhone(PHONE)).toBe('the number ending 678');
    expect(maskPhone('+254 712 345 678')).toBe('the number ending 678');
    expect(maskPhone(null)).toBe('another number');
    expect(maskPhone('12')).toBe('another number');
  });
});

/**
 * The guard is only sound while these hold. They are constants, so nothing
 * fails at runtime when someone edits one — this is where it fails instead.
 */
describe('timing invariants', () => {
  const windowMs = PAYMENT_ATTEMPT_WINDOW_SECONDS * 1000;

  it('a payment request cannot outlive its own claim', () => {
    // Token fetch, then the submit call: the longest a request can spend on the
    // provider while it holds the claim. A hung call finishing AFTER the claim
    // expired is exactly the second prompt the claim exists to prevent.
    const worstCase = PROVIDER_AUTH_TIMEOUT_MS + PROVIDER_SUBMIT_TIMEOUT_MS;
    expect(worstCase).toBeLessThan(windowMs);
    // ...with room for the database calls on either side of it.
    expect(windowMs - worstCase).toBeGreaterThanOrEqual(30_000);
  });

  it('a waiting request gives up well inside a mobile client timeout', () => {
    // The app times a request out at 30s.
    expect(ATTEMPT_WAIT_MS).toBeLessThan(15_000);
  });

  it('polls more than once while waiting, and less than once a millisecond', () => {
    expect(ATTEMPT_POLL_MS).toBeLessThan(ATTEMPT_WAIT_MS);
    expect(ATTEMPT_POLL_MS).toBeGreaterThanOrEqual(100);
  });

  it('the window covers the life of an STK prompt', () => {
    // Safaricom stops honouring a prompt about a minute after it is sent.
    expect(PAYMENT_ATTEMPT_WINDOW_SECONDS).toBeGreaterThanOrEqual(60);
  });
});
