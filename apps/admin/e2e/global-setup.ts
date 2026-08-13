import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/test-db';

/**
 * Runs once before the whole suite. Creates a throwaway `super_admin`
 * account, logs in through the real `/login` form, and saves the resulting
 * cookie session for every test to reuse via `storageState`.
 *
 * Logging in through the actual UI — rather than hand-minting a cookie —
 * matters here: `middleware.ts` reads the session via `@supabase/ssr`'s
 * `createServerClient`, which expects the exact cookie shape
 * `createBrowserClient` writes. A JWT alone (the shape the API's Jest e2e
 * fixtures use) would not satisfy it.
 */
const PASSWORD = 'TestPassword123!';
const STORAGE_STATE_PATH = path.join(__dirname, '.auth/admin.json');

export default async function globalSetup(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const email = `admin-e2e-${Date.now()}@optex-test.local`;
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password: PASSWORD,
  });
  if (signUpError) throw signUpError;

  const { error: promoteError } = await admin.auth.admin.updateUserById(signUpData.user!.id, {
    app_metadata: { role: 'super_admin' },
  });
  if (promoteError) throw promoteError;

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:1113';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder('admin@gmail.com').fill(email);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
