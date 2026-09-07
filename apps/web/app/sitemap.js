/**
 * sitemap.xml, generated from the live catalogue.
 *
 * P-07, the other half. Static routes are listed by hand because they are a
 * fixed, short set; products and categories are fetched through the same
 * `publicApi` the shop and PDP use, so a new frame appears in the sitemap
 * without anyone remembering to add it.
 *
 * A catalogue outage must not 500 this route — a sitemap that returns an error
 * is worse than one listing only the static pages, because Search Console
 * reports the whole file as unreadable. So the fetch is guarded and degrades to
 * the static routes, mirroring how `/shop` degrades to an empty grid.
 *
 * Deliberately excludes everything robots.js disallows: per-customer and
 * transactional pages have nothing to rank and should not be advertised.
 */

import { publicApi } from '@/lib/api-server';
import { siteUrl } from '@/lib/site-url';

/** Re-generate at most hourly; the catalogue changes far more slowly. */
export const revalidate = 3600;

/**
 * Routes that exist regardless of catalogue state.
 *
 * `changeFrequency` and `priority` are hints, not promises — the values say
 * what a crawler should expect: the home and shop pages move with the
 * catalogue, the legal and policy pages effectively never do.
 */
const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/shop', changeFrequency: 'daily', priority: 0.9 },
  { path: '/eye-care', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/branch-locator', changeFrequency: 'monthly', priority: 0.8 },
  // NOT /appointments — it requires a signed-in customer and the middleware
  // redirects it to /login, so listing it would advertise a URL that answers
  // 307 to every crawler. /eye-care above is the public, indexable way in to
  // booking. Kept in step with the disallow list in `app/robots.js`.
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/delivery', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/returns', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/warranty', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap() {
  const base = siteUrl();
  const now = new Date();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let catalogueEntries = [];
  try {
    const api = publicApi({ revalidate: 3600, tags: ['catalogue'] });
    const [products, categories] = await Promise.all([
      api.catalog.listProducts({ limit: 100 }),
      api.catalog.listCategories(),
    ]);

    catalogueEntries = [
      ...(categories ?? []).map((category) => ({
        url: `${base}/category/${category.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })),
      ...(products?.items ?? []).map((product) => ({
        url: `${base}/product/${product.slug}`,
        // `updated_at` is what actually changed, so a crawler that has already
        // seen a frame can skip it; `now` would claim every product changed on
        // every regeneration and train crawlers to ignore the field.
        lastModified: product.updated_at ? new Date(product.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })),
    ];
  } catch (err) {
    // Static routes still ship — see the module comment.
    console.error('[sitemap] catalogue fetch failed:', err);
  }

  return [...staticEntries, ...catalogueEntries];
}
