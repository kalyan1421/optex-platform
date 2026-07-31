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
  return resolveImagePath(product?.images?.[0], fallback);
}

/**
 * Resolve a single stored image path to a displayable URL.
 * Exported separately so the gallery can map over the whole `images` array
 * rather than only ever resolving the first entry.
 */
export function resolveImagePath(img, fallback = '/images/executive_pro.png') {
  if (!img) return fallback;
  if (img.startsWith('http')) return img;
  if (img.startsWith('/seed/')) {
    const name = img.replace('/seed/', '');
    return SEED_MAP[name] ?? fallback;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/product-images${img}`;
}

/**
 * Every displayable image for a product, de-duplicated and in order.
 *
 * The PDP gallery previously rendered four thumbnails that all pointed at
 * `mainImage`, so a product with genuinely different angles showed the same
 * photo four times and a product with one photo looked like it had four.
 * Returns a single-entry array rather than padding, so the gallery can hide
 * the thumbnail strip when there is nothing to switch between.
 */
export function getProductImageUrls(product, fallback = '/images/executive_pro.png') {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  if (images.length === 0) return [fallback];
  return Array.from(new Set(images.map((img) => resolveImagePath(img, fallback))));
}
