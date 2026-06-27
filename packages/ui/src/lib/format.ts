const KES_WHOLE = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
})

const KES_PRECISE = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 2,
})

/**
 * Format a KES amount for display. Defaults to whole shillings (no decimals)
 * because product prices in this catalog are always whole-numbered. Pass
 * `{ precise: true }` for line-item / total displays where 16% VAT can
 * produce fractional values.
 */
export function formatKes(amount: number | null | undefined, opts?: { precise?: boolean }): string {
  if (amount == null || !isFinite(amount)) return '—'
  return (opts?.precise ? KES_PRECISE : KES_WHOLE).format(amount)
}
