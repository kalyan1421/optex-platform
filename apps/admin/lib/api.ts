'use client'

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

import { createApiClient, type ApiClient } from '@optex/api-client'
import { createBrowserSupabase } from '@optex/db/browser'

const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const api: ApiClient = createApiClient({
  baseUrl,
  getAccessToken: async () => {
    const supabase = createBrowserSupabase()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})
