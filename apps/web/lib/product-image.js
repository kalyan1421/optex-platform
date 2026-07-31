const SEED_MAP = {
  'executive_pro.png': '/images/executive_pro.png',
  'classic_aviator.png': '/images/classic_aviator.png',
  'retro_round.png': '/images/retro_round.png',
};

/**
 * Resolve a product image path to a displayable URL.
 * Seed products use /seed/<name>.png paths in storage; map those to the
 * equivalent public/ asset so dev works without uploading to the bucket.
 * Real catalog images will be full https:// Supabase Storage URLs.
 */
export function getProductImageUrl(product, fallback = '/images/executive_pro.png') {
  const img = product?.images?.[0];
  if (!img) return fallback;
  if (img.startsWith('http')) return img;
  if (img.startsWith('/seed/')) {
    const name = img.replace('/seed/', '');
    return SEED_MAP[name] ?? fallback;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/product-images${img}`;
}
