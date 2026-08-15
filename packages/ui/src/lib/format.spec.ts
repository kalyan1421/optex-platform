import { formatKes, formatKesNumber } from './format';

/**
 * Unit tests for the shared money formatters (audit F-08).
 *
 * These render every price a customer sees. A `NaN` here is a live product page
 * reading "KES NaN"; a dropped cent is a total that does not match what the
 * customer is charged. Neither had a test before this file.
 *
 * Assertions target the parts that carry meaning — digits, separators, the
 * placeholder — rather than exact strings, because Intl output varies with the
 * ICU build (non-breaking vs regular spaces, symbol placement) and a test that
 * fails on a Node upgrade teaches nobody anything.
 */
describe('formatKes', () => {
  it('formats a whole number with thousands separators', () => {
    expect(formatKes(26000)).toContain('26,000');
  });

  it('returns the em-dash placeholder rather than NaN for missing values', () => {
    // The documented reason this helper exists. A product mid-edit, a failed
    // fetch or a genuinely null column must not put "NaN" in front of anyone.
    for (const bad of [null, undefined, NaN, Infinity]) {
      expect(formatKes(bad as unknown as number)).toBe('—');
    }
  });

  it('does not treat zero as missing', () => {
    // `0` is falsy, so a naive `value || placeholder` swallows a legitimately
    // free item — and free lens fittings are a real line on these orders.
    expect(formatKes(0)).toContain('0');
    expect(formatKes(0)).not.toBe('—');
  });

  it('drops the cents by default and keeps them when asked', () => {
    // The default is the catalogue, where cents are noise. `precise` is for
    // money totals, where dropping them changes the amount charged.
    expect(formatKes(1234.56)).not.toContain('.56');
    expect(formatKes(1234.56, { precise: true })).toContain('.56');
  });

  it('formats a negative amount, which a refund produces', () => {
    expect(formatKes(-500)).toMatch(/[-(]/);
    expect(formatKes(-500)).toContain('500');
  });
});

describe('formatKesNumber', () => {
  it('keeps cents by default — every call site is a money total', () => {
    // The inverse default to formatKes, and deliberately so: these render
    // subtotal, VAT and order total, where rounding is a real discrepancy.
    expect(formatKesNumber(1234.5)).toContain('.50');
  });

  it('drops them when explicitly told to', () => {
    expect(formatKesNumber(1234.5, { precise: false })).not.toContain('.5');
  });

  it('omits any currency symbol, so callers can render their own label', () => {
    expect(formatKesNumber(2500)).not.toMatch(/KES|Ksh/i);
    expect(formatKesNumber(2500)).toContain('2,500');
  });

  it('shares the placeholder behaviour with formatKes', () => {
    expect(formatKesNumber(null)).toBe('—');
    expect(formatKesNumber(undefined)).toBe('—');
    expect(formatKesNumber(NaN)).toBe('—');
  });
});
