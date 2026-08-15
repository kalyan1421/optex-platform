import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal `.env.local` loader — no `dotenv` dependency needed. Playwright's
 * Node process (global-teardown, and any spec/config code that talks to
 * Supabase directly) does not get Next.js's automatic env loading, unlike the
 * `next build && next start` the webServer itself runs.
 */
function loadEnvLocal(): void {
  const envPath = path.join(__dirname, '../../.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

let cached: SupabaseClient | undefined;

/** Service-role Supabase client for cleaning up test fixtures directly. */
export function getTestDb(): SupabaseClient {
  if (cached) return cached;
  loadEnvLocal();
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return cached;
}

export { loadEnvLocal };
