/**
 * The storefront's own public origin, with no trailing slash.
 *
 * Extracted from `app/layout.jsx`'s `metadataBase`, which had the same literal
 * inline, once robots.txt and the sitemap needed it too — three copies of a
 * fallback origin is how one of them ends up pointing at the wrong host after a
 * domain change.
 *
 * `NEXT_PUBLIC_SITE_URL` lets a preview deployment describe itself rather than
 * claiming to be production; without it, a preview's sitemap would advertise
 * production URLs and its canonicals would point away from the pages being
 * reviewed.
 */
export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://optexopticians.co.ke';
  return raw.replace(/\/+$/, '');
}
