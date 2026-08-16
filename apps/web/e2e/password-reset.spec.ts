import { test, expect } from '@playwright/test';

/**
 * Password reset — audit finding F-22.
 *
 * `forgot-password` and `reset-password` were the last customer-facing auth
 * flow still calling Supabase directly from the browser
 * (`db.auth.resetPasswordForEmail`, `db.auth.updateUser`). Every other
 * mutation — login, signup, refresh, logout — already went through
 * `/api/auth/*`; this brought reset traffic into the same proxy, which also
 * means it now inherits the API's rate limiting and request-id logging.
 *
 * The actual reset-link round trip (click the emailed link, land on
 * `/reset-password` with a live recovery session, set a new password) is
 * covered server-side in `apps/api/test/password-reset.e2e-spec.ts` against
 * real Supabase Auth — there is no mail catcher in this stack to intercept
 * the email and drive that from a browser. What a browser CAN verify, and
 * what these tests are for, is the thing an API test structurally cannot see:
 * which network origin the request actually goes to.
 */

function throwawayEmail(): string {
  return `resetflow-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

test('requesting a reset calls the API, never Supabase directly', async ({ page }) => {
  const supabaseCalls: string[] = [];
  // Watches EVERY request the page makes for the rest of this test, not just
  // ones we expect — a regression back to `db.auth.resetPasswordForEmail()`
  // would show up here even if the UI still looked correct.
  page.on('request', (req) => {
    if (req.url().includes('supabase.co') || req.url().includes(':54321')) {
      supabaseCalls.push(`${req.method()} ${req.url()}`);
    }
  });

  await page.goto('/forgot-password');
  await page.getByPlaceholder('you@example.com').fill(throwawayEmail());

  const apiCall = page.waitForResponse(
    (res) => res.url().includes('/api/auth/forgot-password') && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /send reset link/i }).click();
  const response = await apiCall;

  expect(response.status()).toBe(200);
  await expect(page.getByText(/check your email/i)).toBeVisible();

  // The one assertion this whole file exists for.
  expect(supabaseCalls).toEqual([]);
});

test('the success state never reveals whether the email is registered', async ({ page }) => {
  // Same UI response for an address nobody has ever signed up with — if the
  // page (or the API behind it) ever special-cased this, it would be an
  // account-enumeration oracle. Covered from the API side too
  // (password-reset.e2e-spec.ts asserts byte-identical responses); this is
  // the same guarantee from where a customer actually experiences it.
  await page.goto('/forgot-password');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`never-signed-up-${Date.now()}@optex-test.local`);
  await page.getByRole('button', { name: /send reset link/i }).click();

  await expect(page.getByText(/check your email/i)).toBeVisible();
});

test('arriving at /reset-password with no recovery session shows an invalid-link state, not a broken form', async ({
  page,
}) => {
  // No #access_token hash — exactly what happens if someone bookmarks the
  // page, or a stale/already-used link is opened a second time.
  await page.goto('/reset-password');

  await expect(page.getByText(/invalid or expired reset link/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /request new link/i })).toBeVisible();

  // The submit button must stay disabled — nothing here should let a
  // sessionless request reach the API at all, let alone succeed.
  await expect(page.getByRole('button', { name: /set new password/i })).toBeDisabled();
});
