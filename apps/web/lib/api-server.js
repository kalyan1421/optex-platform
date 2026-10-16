import 'server-only';

/**
 * Server-side OPTEX API client — the Server Component half of `lib/api.js`.
 *
 * This is gap G-7 in the API migration plan. `lib/api.js` is `'use client'`
 * and resolves its base URL from `window.location.origin`, so a Server
 * Component cannot use it at all: there is no window, and the browser's
 * `/api` rewrite proxy does not exist server-side. Every page Wave 4 moves to
 * the server needs this, and nothing else does — which is why it is built
 * first.
 *
 * Two factories, because the choice between them decides whether a page can be
 * cached:
 *
 *   publicApi()  — no cookies, no Authorization header. The response is
 *                  identical for every visitor, so Next may cache it and the
 *                  page can render statically. This is the one the catalogue
 *                  pages want, and the reason the SEO rewrite is worth doing.
 *
 *   sessionApi() — reads the caller's Supabase session from the request
 *                  cookies. Touching cookies opts the route into dynamic
 *                  rendering, so the page is rendered per request. Correct for
 *                  anything customer-specific; wrong for the catalogue.
 *
 * Picking `sessionApi` for a public page silently costs the caching that Wave 4
 * exists to gain, so the split is deliberate rather than a single client with
 * an options bag.
 */

import { cookies } from 'next/headers';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { createApiClient } from '@optex/api-client';
import { createServerSupabase } from '@optex/db/server';

/**
 * API origin for server-side calls.
 *
 * `API_INTERNAL_URL` lets a deployment route server traffic over a private
 * address (container network, service mesh) while browsers keep using the
 * public one. Falls back to the public URL, then to the local dev API.
 */
function serverBaseUrl() {
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1111';
}

/**
 * Client for public, cacheable reads — catalogue, categories, branches.
 *
 * @param {object} [opts]
 * @param {number|false} [opts.revalidate] Seconds before Next refetches.
 *   `false` caches indefinitely, `0` disables caching. Defaults to 60: long
 *   enough that a crawler or a burst of traffic hits cache, short enough that a
 *   price edit in the admin panel appears within a minute.
 * @param {string[]} [opts.tags] Cache tags, so a future admin write can call
 *   `revalidateTag()` instead of waiting out the window.
 */
export function publicApi({ revalidate = 60, tags } = {}) {
  return createApiClient({
    baseUrl: serverBaseUrl(),
    // No getAccessToken on purpose — see the module comment.
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        next: { revalidate, ...(tags ? { tags } : {}) },
      }),
  });
}

/**
 * Runs a public read for a statically cached (ISR) page without letting an
 * outage become the cached page.
 *
 * Catching a failed fetch and rendering the empty state looks harmless, but on
 * a static page that empty render IS the cache entry: every visitor sees
 * "Check back soon" until a later regeneration happens to succeed. Production
 * hit exactly this — the API sleeps when idle on Render's free tier and takes
 * longer to wake than the client's 20s timeout, so a regeneration that landed
 * on a sleeping API cached a homepage with no products.
 *
 * So the read is retried once (the first request is what wakes a sleeping
 * instance; a 4xx is not retried, it would only fail again), and if it still
 * fails:
 * - during `next build`, or outside production, it returns `empty` — a deploy
 *   must not fail because the API was asleep, and a developer without the API
 *   running still gets a page;
 * - at runtime in production it throws. Next keeps serving the last page that
 *   rendered successfully and retries on the next request, so a page that has
 *   ever had data never regresses to empty.
 *
 * Only for static pages: on a dynamic route the throw would reach the visitor
 * as an error page.
 *
 * @template T
 * @param {string} label Log prefix, e.g. `'home:TrendingNow'`.
 * @param {() => Promise<T>} read
 * @param {T} empty What to render when the read cannot succeed at build time.
 * @returns {Promise<T>}
 */
export async function readForStaticPage(label, read, empty) {
  try {
    return await read();
  } catch (firstError) {
    if (isClientError(firstError)) return giveUp(label, firstError, empty);
    try {
      return await read();
    } catch (error) {
      return giveUp(label, error, empty);
    }
  }
}

function isClientError(error) {
  return typeof error?.status === 'number' && error.status >= 400 && error.status < 500;
}

function giveUp(label, error, empty) {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD || process.env.NODE_ENV !== 'production') {
    console.error(`[${label}] read failed, rendering the empty state:`, error);
    return empty;
  }
  throw error;
}

/**
 * `GET /products` with a homepage curation flag (`featured` or `trending`),
 * retried without the flag when the API rejects it.
 *
 * The flags arrived with migration 0041. An API deployed before them answers
 * the unknown property with a 400, which is what blanked Trending Now while
 * production's API deploys were failing. Newest-first without the flag is what
 * an up-to-date API returns anyway when nothing is flagged, so the fallback
 * shows the section the API itself would have shown.
 */
export async function listCuratedProducts(api, { featured, trending, ...query }) {
  const flag = featured ? { featured } : trending ? { trending } : {};
  try {
    return await api.catalog.listProducts({ ...query, ...flag });
  } catch (error) {
    if (error?.status !== 400 || !(featured || trending)) throw error;
    return api.catalog.listProducts(query);
  }
}

/**
 * Client for reads that depend on who is asking — orders, profile, cart.
 *
 * Reading cookies makes the route dynamic. That is the correct trade for
 * customer-specific data, and the wrong one for the catalogue.
 */
export function sessionApi() {
  return createApiClient({
    baseUrl: serverBaseUrl(),
    getAccessToken: async () => {
      const supabase = createServerSupabase(await cookies());
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
    // Never cache a response that varies per customer.
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  });
}
