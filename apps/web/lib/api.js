'use client'

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

import { createApiClient } from '@optex/api-client'
import { createBrowserSupabase } from '@optex/db/browser'

const baseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1111')

export const api = createApiClient({
  baseUrl,
  getAccessToken: async () => {
    const supabase = createBrowserSupabase()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})
