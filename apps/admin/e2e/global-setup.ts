import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/test-db';
import { computeTotp } from './lib/totp';

/**
 * Runs once before the whole suite. Creates a throwaway `super_admin`
 * account, enrolls and verifies a real TOTP factor for it, logs in through
 * the real `/login` form, completes the resulting `/mfa-challenge` step-up
 * with a freshly computed code, and saves the cookie session for every test
 * to reuse via `storageState`.
 *
 * R1 1e added a mandatory 2FA step-up for `super_admin` (`middleware.ts` +
 * `PermissionsGuard`). Rather than a test-only bypass flag, this drives the
 * real enrollment/challenge flow the same way an actual admin would — the
 * TOTP secret is computed with the same ~15-line RFC 6238 implementation
 * `apps/api/test/mfa-enforcement.e2e-spec.ts` uses, deliberately not
 * shared/extracted: two small, stable, independent copies across the API and
 * admin test suites, not a new shared test-utils package for one function.
 *
 * Logging in through the actual UI — rather than hand-minting a cookie —
 * matters here: `middleware.ts` reads the session via `@supabase/ssr`'s
 * `createServerClient`, which expects the exact cookie shape
 * `createBrowserClient` writes. A JWT alone (the shape the API's Jest e2e
 * fixtures use) would not satisfy it.
 */
const PASSWORD = 'TestPassword123!';
const STORAGE_STATE_PATH = path.join(__dirname, '.auth/admin.json');

/**
 * Fails fast when this suite and the API are pointed at different Supabase
 * projects.
 *
 * This suite creates its fixtures with the ADMIN app's Supabase credentials,
 * then signs in through the browser — and that sign-in goes to the API, which
 * verifies the password against whatever Supabase IT is configured with. If
 * the two differ, the fixture user exists in one database and is authenticated
 * against another, so login fails with "Invalid login credentials" and every
 * spec dies at `waitForURL('**\/mfa-challenge')` twenty seconds later.
 *
 * That is exactly how this suite rotted: `apps/admin/.env.local` pointed at a
 * hosted project while `apps/api/.env` pointed at local Docker, and because
 * the suite has never run in CI, nothing said so. The timeout gives no hint of
 * the cause; this does.
 *
 * Only checked when the API is local — a deployed API's Supabase URL is not
 * something this process can read.
 */
function assertSupabaseMatchesApi(adminSupabaseUrl: string): void {
  const apiEnvPath = path.join(__dirname, '../../api/.env');
  let apiEnv: string;
  try {
    apiEnv = fs.readFileSync(apiEnvPath, 'utf-8');
  } catch {
    return; // No local API checkout to compare against — nothing to assert.
  }

  const match = apiEnv.match(/^SUPABASE_URL=(.*)$/m);
  const apiSupabaseUrl = match?.[1]?.trim();
  if (!apiSupabaseUrl || apiSupabaseUrl === adminSupabaseUrl) return;

  throw new Error(
    'Supabase mismatch between the admin app and the API.\n' +
      `  apps/admin/.env.local NEXT_PUBLIC_SUPABASE_URL = ${adminSupabaseUrl}\n` +
      `  apps/api/.env         SUPABASE_URL             = ${apiSupabaseUrl}\n\n` +
      'This suite creates its fixture user with the first and signs in through the API, ' +
      'which authenticates against the second — so login always fails. Point both at the ' +
      'same Supabase (apps/*/.env.example use the local Docker stack) and re-run.',
  );
}

export default async function globalSetup(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  assertSupabaseMatchesApi(supabaseUrl);

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: true } });
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

  // Enroll + verify a TOTP factor on a throwaway session of our own — this is
  // what marks the factor "verified" against the user, which is what matters
  // for the browser's later, separate session to see it via listFactors().
  // The aal2 promotion this produces on THIS anon-client session is otherwise
  // unused and discarded.
  const { error: setupSignInError } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (setupSignInError) throw setupSignInError;
  const { data: enrolled, error: enrollError } = await anon.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollError) throw enrollError;
  const setupCode = computeTotp(enrolled.totp.secret);
  const { error: setupVerifyError } = await anon.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: setupCode,
  });
  if (setupVerifyError) throw setupVerifyError;

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:1113';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder('admin@gmail.com').fill(email);
  await page.getByPlaceholder('Enter password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // The browser's sign-in is a brand-new session, aal1 — middleware.ts sends
  // it to /mfa-challenge regardless of the anon-client enrollment above.
  await page.waitForURL('**/mfa-challenge', { timeout: 20_000 });
  await page.getByPlaceholder('123456').fill(computeTotp(enrolled.totp.secret));
  await page.getByRole('button', { name: /^verify$/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
