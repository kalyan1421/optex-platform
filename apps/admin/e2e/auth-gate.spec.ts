import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './lib/test-db';

/**
 * `middleware.ts` gates every route except `/login` on
 * `app_metadata.role === 'super_admin'`. The suite's default `storageState`
 * (an authenticated super_admin session, from `global-setup.ts`) proves the
 * happy path implicitly on every other spec file — these two prove the gate
 * itself, for the two ways around it: no session at all, and a session that
 * is authenticated but not an admin.
 */

test.describe('Admin auth gate', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a signed-out visitor is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('a signed-in customer (not an admin) is redirected to login, not shown the panel', async ({
    page,
  }) => {
    loadEnvLocal();
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const email = `admin-e2e-notadmin-${Date.now()}@optex-test.local`;
    const password = 'TestPassword123!';
    const { error } = await anon.auth.signUp({ email, password });
    if (error) throw error;

    await page.goto('/login');
    await page.getByPlaceholder('admin@gmail.com').fill(email);
    await page.getByPlaceholder('Enter password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // The login page itself checks the role and shows this message without
    // ever navigating away — middleware is the backstop, not the only gate.
    await expect(page.getByText(/access denied/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
