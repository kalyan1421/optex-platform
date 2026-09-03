'use client';

/**
 * Shared OPTEX API client for the super-admin panel.
 *
 * Wires `@optex/api-client` to the browser Supabase session so every request
 * carries `Authorization: Bearer <access_token>`. Admin endpoints are gated
 * server-side by `@Roles('super_admin')`, so the signed-in admin's JWT (with
 * `app_metadata.role = 'super_admin'`) authorizes them automatically.
 *
 * Base URL comes from `NEXT_PUBLIC_API_URL`; falls back to the local API in dev.
 */

import { createApiClient, type ApiClient } from '@optex/api-client';
import { createBrowserSupabase } from '@optex/db/browser';

const baseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1111';

// See apps/web/lib/api.js for why this exists: the cached Supabase session
// can outlive the token it holds being valid server-side. Left alone every
// admin page's `GET /auth/me` (and everything else) 401s independently while
// the panel still looks signed in. Sign the stale session out on the first
// such 401 and send the staff member back to login.
let handlingExpiredSession = false;

export const api: ApiClient = createApiClient({
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
