import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseServiceRoleKey, supabaseUrl } from './env'

// Defence-in-depth: 'server-only' is the primary guard, but if anyone ever
// transpiles this into a client bundle (e.g. via a misconfigured shared
// component) we'd rather fail loudly than ship the service key.
if (typeof window !== 'undefined') {
  throw new Error('[@optex/db/service] must never be imported on the client.')
}

/**
 * Service-role client. Bypasses RLS — use ONLY for trusted server-side flows:
 * payment webhooks (Daraja / Pesapal IPN), SMS senders, admin-only background
 * jobs. Never import this from a client component.
 */
let cached: ReturnType<typeof createClient<Database>> | undefined

export function createServiceSupabase() {
  if (cached) return cached
  cached = createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
