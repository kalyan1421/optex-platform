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
