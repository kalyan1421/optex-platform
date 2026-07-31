'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

export type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

// L-2 NOTE: this module-level cache is intentional for the browser — one
// Supabase client per page load is correct (the client manages its own session
// internally). If you need to force a fresh client (e.g. after swapping anon
// keys in tests), call `resetBrowserSupabaseCache()` before the next call.
let cached: BrowserClient | undefined;

export function createBrowserSupabase(): BrowserClient {
  if (cached) return cached;
  cached = createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return cached;
}

export function resetBrowserSupabaseCache(): void {
  cached = undefined;
}
