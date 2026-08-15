import {
  FINAL_TX_STATUSES,
  TX_STATUS,
  darajaTimestamp,
  isProd,
  normalizeKenyanMsisdn,
} from '../../src/modules/payments/payments.constants';

/**
 * Unit tests for the payment helpers (audit F-08).
 *
 * Lives under `test/` rather than beside the source: `apps/api/tsconfig.json`
 * deliberately scopes `include` to `src/**` with `types: ["node"]`, so that
 * tests never reach the build output. A colocated spec compiles without Jest's
 * globals and turns `pnpm -r typecheck` red. `test/tsconfig.json` is the one
 * that carries the jest types.
 *
 * Every one of these was previously reachable only by booting the whole
 * `AppModule` and posting to a real database — so in practice the edge cases
 * simply were not covered. `normalizeKenyanMsisdn` in particular decides which
 * phone number a customer's STK push goes to; getting it wrong sends the
 * payment prompt to the wrong handset, and nothing tested it directly.
 */
describe('normalizeKenyanMsisdn', () => {
  // The four shapes a Kenyan customer might realistically type, all of which
  // have to end up identical before they reach Daraja.
  it.each([
    ['0712345678', '254712345678'],
    ['+254712345678', '254712345678'],
    ['254712345678', '254712345678'],
    ['712345678', '254712345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeKenyanMsisdn(input)).toBe(expected);
  });

  it('accepts the 01 range as well as 07', () => {
    // Safaricom issues 011x numbers; treating them as invalid would refuse
    // payment from a real and growing block of customers.
    expect(normalizeKenyanMsisdn('0112345678')).toBe('254112345678');
    expect(normalizeKenyanMsisdn('112345678')).toBe('254112345678');
  });

  it('strips whatever punctuation people type', () => {
    expect(normalizeKenyanMsisdn('+254 712 345 678')).toBe('254712345678');
    expect(normalizeKenyanMsisdn('0712-345-678')).toBe('254712345678');
    expect(normalizeKenyanMsisdn('(0712) 345 678')).toBe('254712345678');
  });

  it.each([
    ['', 'empty'],
    ['abcdefgh', 'no digits at all'],
    ['071234567', 'one digit short'],
    ['07123456789', 'one digit long'],
    ['254512345678', 'not a mobile prefix'],
    ['1234567890', 'not Kenyan'],
  ])('rejects %s (%s)', (input) => {
    // Returning null rather than a best guess matters: a wrong-but-plausible
    // MSISDN sends someone else the payment prompt.
    expect(normalizeKenyanMsisdn(input)).toBeNull();
  });

  it('does not throw on null or undefined input', () => {
    expect(normalizeKenyanMsisdn(null as unknown as string)).toBeNull();
    expect(normalizeKenyanMsisdn(undefined as unknown as string)).toBeNull();
  });
});

describe('darajaTimestamp', () => {
  it('formats as YYYYMMDDHHmmss with zero padding', () => {
    // Single-digit months, days, hours and minutes are exactly where an
    // unpadded implementation produces a 13-character string Daraja rejects.
    expect(darajaTimestamp(new Date(2026, 0, 5, 9, 7, 3))).toBe('20260105090703');
  });

  it('handles a two-digit date without padding it further', () => {
    expect(darajaTimestamp(new Date(2026, 11, 25, 23, 59, 59))).toBe('20261225235959');
  });

  it('is always exactly 14 characters', () => {
    for (const d of [new Date(2026, 0, 1, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59)]) {
      expect(darajaTimestamp(d)).toHaveLength(14);
    }
  });
});

describe('isProd', () => {
  it('is true only for the exact string "production"', () => {
    expect(isProd('production')).toBe(true);
    // Anything else must fall back to the sandbox host — this is the switch
    // that keeps dev and CI off the live money rails, so a fuzzy match here
    // would be dangerous rather than convenient.
    expect(isProd('Production')).toBe(false);
    expect(isProd('prod')).toBe(false);
    expect(isProd('development')).toBe(false);
    expect(isProd(undefined)).toBe(false);
  });
});

describe('FINAL_TX_STATUSES', () => {
  it('covers every terminal status and excludes pending', () => {
    // A webhook that re-applies a terminal transaction double-credits an order.
    expect(FINAL_TX_STATUSES).toContain(TX_STATUS.MATCHED);
    expect(FINAL_TX_STATUSES).toContain(TX_STATUS.FAILED);
    expect(FINAL_TX_STATUSES).toContain(TX_STATUS.REVERSED);
    expect(FINAL_TX_STATUSES).not.toContain(TX_STATUS.PENDING);
  });

  it('has an entry for every status except pending', () => {
    // Guards against someone adding a status to TX_STATUS and forgetting to
    // classify it — the new value would silently be treated as non-terminal.
    const all = Object.values(TX_STATUS);
    expect(FINAL_TX_STATUSES).toHaveLength(all.length - 1);
  });
});
