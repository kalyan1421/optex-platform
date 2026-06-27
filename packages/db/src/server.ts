import 'server-only'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from './database.types'
import { supabaseAnonKey, supabaseUrl } from './env'

/**
 * Server-side Supabase client bound to the calling request's cookie jar.
 *
 * Pass in Next.js's `cookies()` result (lazily evaluated — do NOT call
 * cookies() outside a request scope). Used from Server Components, Route
 * Handlers, and Server Actions.
 */
export function createServerSupabase(cookieStore: {
  get(name: string): { value: string } | undefined
  set?(name: string, value: string, options?: CookieOptions): void
  delete?(name: string, options?: CookieOptions): void
}) {
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        try {
          cookieStore.set?.(name, value, options)
        } catch (e) {
          // H-7 FIX: log unexpected errors so misconfiguration is visible.
          // Expected no-op: Server Components cannot write cookies — writes
          // happen in Route Handlers / middleware where set() is defined.
          if (process.env.NODE_ENV === 'development') {
            console.error('[db/server] cookieStore.set failed:', e)
          }
        }
      },
      remove(name, options) {
        try {
          cookieStore.delete?.(name, options)
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[db/server] cookieStore.delete failed:', e)
          }
        }
      },
    },
  })
}
