import { test, expect } from '@playwright/test';

/**
 * Booking requires an account (client decision B4), and `POST /appointments`
 * returns 401 without a token.
 *
 * The redirect has to happen on arrival. It used to fire on submit, so a
 * signed-out customer picked a branch, a date and a slot, filled in their
 * details, and only then got bounced to sign in — losing all of it. /checkout
 * has always redirected on mount; this makes booking behave the same way.
 */
test('a signed-out visitor is sent to login on arrival, not on submit', async ({ page }) => {
  await page.goto('/appointments');

  await page.waitForURL(/\/login\?redirect=/);
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/appointments');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

  // The booking form must not have been reachable at all.
  await expect(page.getByRole('button', { name: /confirm booking|book appointment/i })).toHaveCount(
    0,
  );
});
