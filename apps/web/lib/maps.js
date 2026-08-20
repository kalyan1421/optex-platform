// ── Fallback centre of Nairobi ────────────────────────────────────────────────
export const NAIROBI_LAT = -1.2921;
export const NAIROBI_LNG = 36.8219;

// ── Build the Google Maps embed URL ─────────────────────────────────────────
export function buildMapUrl(branch) {
  if (branch?.lat && branch?.lng) {
    return `https://maps.google.com/maps?q=${branch.lat},${branch.lng}&z=15&output=embed`;
  }
  if (branch?.address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(branch.address)}&output=embed`;
  }
  return `https://maps.google.com/maps?q=${NAIROBI_LAT},${NAIROBI_LNG}&z=13&output=embed`;
}
