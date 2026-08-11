const KES_WHOLE = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const KES_PRECISE = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 2,
});

export function formatKes(amount: number | null | undefined, opts?: { precise?: boolean }): string {
  if (amount == null || !isFinite(amount)) return '—';
  return (opts?.precise ? KES_PRECISE : KES_WHOLE).format(amount);
}

const KES_NUMBER_WHOLE = new Intl.NumberFormat('en-KE', {
  maximumFractionDigits: 0,
});

const KES_NUMBER_PRECISE = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * `formatKes` without the currency prefix, for layouts that render their own
 * "KSH." label alongside the figure.
 *
 * Unlike `formatKes`, this defaults to `precise` — every call site is a money
 * total (line totals, subtotal, VAT, order total), where dropping the cents
 * would round the amount the customer is about to pay. Pass
 * `{ precise: false }` for whole-shilling display.
 */
export function formatKesNumber(amount: number | null | undefined, opts?: { precise?: boolean }): string {
  if (amount == null || !isFinite(amount)) return '—';
  return (opts?.precise ?? true ? KES_NUMBER_PRECISE : KES_NUMBER_WHOLE).format(Number(amount));
}
