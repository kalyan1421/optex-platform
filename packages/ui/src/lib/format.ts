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

export function formatKesNumber(amount: number | null | undefined, opts?: { precise?: boolean }): string {
  if (amount == null || !isFinite(amount)) return '—';
  return Number(amount).toFixed(2);
}
