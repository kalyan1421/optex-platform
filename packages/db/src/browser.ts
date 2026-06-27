'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { supabaseAnonKey, supabaseUrl } from './env'

export type BrowserClient = ReturnType<typeof createBrowserClient<Database>>

let cached: BrowserClient | undefined

export function createBrowserSupabase(): BrowserClient {
  if (cached) return cached
  cached = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
  return cached
}
