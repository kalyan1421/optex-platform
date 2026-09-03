'use client';

/**
 * Shared OPTEX API client for the storefront.
 *
 * Wires `@optex/api-client` to the browser Supabase session so every request
 * automatically carries `Authorization: Bearer <access_token>` for the
 * logged-in customer. Public endpoints work without a token.
 *
 * Base URL comes from `NEXT_PUBLIC_API_URL` (e.g. https://api.optexopticians.com);
 * falls back to the local API on :1111 in development.
 */

import { createApiClient } from '@optex/api-client';
import { createBrowserSupabase } from '@optex/db/browser';

const baseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1111';

// `supabase.auth.getSession()` returns the locally cached session without a
// network round-trip, so it keeps believing the customer is signed in even
// after the token it holds is rejected server-side (expired, revoked, or the
// account behind it no longer exists). Left alone, every authenticated call
// on the page then fails the same way — cart, wishlist, orders, prescription
// — each logging its own "Invalid or expired access token" independently
// while the UI still looks logged in. `onUnauthorized` below breaks that:
// the first such 401 signs the stale session out and sends the customer to
// login instead. Guarded so a burst of parallel requests only does it once.
let handlingExpiredSession = false;

export const api = createApiClient({
  baseUrl,
  getAccessToken: async () => {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  onUnauthorized: () => {
    if (typeof window === 'undefined' || handlingExpiredSession) return;
    if (window.location.pathname.startsWith('/login')) return;
    handlingExpiredSession = true;
    const supabase = createBrowserSupabase();
    supabase.auth.signOut().finally(() => {
      window.location.href = '/login?expired=1';
    });
  },
});
