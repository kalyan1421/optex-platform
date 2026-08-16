import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/test-db';

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

function base32Decode(base32: string): Buffer {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const val = ALPHABET.indexOf(char);
    if (val === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function computeTotp(base32Secret: string, timeStepSeconds = 30, digits = 6): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, '0');
}

export default async function globalSetup(): Promise<void> {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
