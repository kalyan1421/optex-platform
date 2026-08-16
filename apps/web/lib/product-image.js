const SEED_MAP = {
  'executive_pro.png': '/images/executive_pro.png',
  'classic_aviator.png': '/images/classic_aviator.png',
  'retro_round.png': '/images/retro_round.png',
};

/**
 * Resolve a single raw stored image path to a displayable URL.
 *
 * Seed products use `/seed/<name>.png` paths in storage; map those to the
 * equivalent `public/` asset so dev works without uploading to the bucket.
 * Real catalog images are full `https://` Supabase Storage URLs.
 *
 * The single-path variant of `getProductImageUrl`, extracted so callers that
 * only have one raw path in hand (the cart API returns `product.image`, not
 * the full `images` array) don't have to fake a `{ images: [path] }` wrapper
 * to reuse this logic. `next/image` needs this resolution to have actually
 * happened — an un-mapped `/seed/*.png` path 404s and, unlike a plain `<img>`
 * silently failing, Next's optimizer surfaces it as a loud server error.
 */
export function resolveImageUrl(img, fallback = '/images/executive_pro.png') {
  if (!img) return fallback;
  if (img.startsWith('http')) return img;
  if (img.startsWith('/seed/')) {
    const name = img.replace('/seed/', '');
    return SEED_MAP[name] ?? fallback;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/product-images${img}`;
}

/** Resolve a product's first catalogue image to a displayable URL. */
export function getProductImageUrl(product, fallback = '/images/executive_pro.png') {
  return resolveImageUrl(product?.images?.[0], fallback);
}
