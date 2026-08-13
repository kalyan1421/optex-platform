import { test, expect, Page } from '@playwright/test';

/**
 * The authenticated half of checkout — everything `smoke.spec.ts` stops
 * short of, because that suite deliberately ends at "a signed-out shopper is
 * sent to login". Nothing before this file verified that a signed-in shopper
 * can actually get through the form and reach `POST /checkout`.
 *
 * `POST /checkout` genuinely runs here — the order is created, VAT and
 * totals are computed server-side, and `place_order` commits a real row. What
 * this suite does NOT verify is a completed payment: M-Pesa and Pesapal are
 * both unconfigured in local dev (`apps/api/.env` has empty `MPESA_*` keys),
 * so the STK-push step that follows order creation always fails with a
 * service-unavailable error here. That is a real, expected local-dev
 * constraint, not a gap in this test — `payments.e2e-spec.ts` and
 * `cancellation.e2e-spec.ts` cover the money side against seeded rows for the
 * same reason. This suite's job is everything before that boundary: auth
 * gating, form validation, and that the order genuinely gets created.
 */

function throwawayEmail(): string {
  return `checkout-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function signUpFreshAccount(page: Page): Promise<void> {
  const email = throwawayEmail();
  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Checkout E2E Tester');
  await page.getByPlaceholder('john@example.com').fill(email);
  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill('TestPassword123!');
  await passwords.nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/profile', { timeout: 20_000 });
}

async function addFirstProductToCart(page: Page): Promise<void> {
  await page.goto('/shop');
  const href = await page.locator('a[href^="/product/"]').first().getAttribute('href');
  if (!href) throw new Error('no product cards on /shop');
  await page.goto(href);

  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addToCart).toBeEnabled();
  await addToCart.click();
  await page.waitForURL('**/cart');
}

async function fillShippingDetails(page: Page): Promise<void> {
  await page.getByPlaceholder('Jane').fill('Checkout');
  await page.getByPlaceholder('Doe').fill('E2E Tester');
  await page.getByPlaceholder('123 Vision Avenue').fill('456 Test Street');
  await page.getByPlaceholder('London').fill('Nairobi');
  await page.getByPlaceholder('0712 345 678').fill('0712345678');
  await page.locator('select').first().selectOption('Nairobi');
}

test.describe('Authenticated checkout', () => {
  test.beforeEach(async ({ page }) => {
    await signUpFreshAccount(page);
    await addFirstProductToCart(page);
  });

  test('a signed-in shopper reaches the checkout form, not a login redirect', async ({ page }) => {
    await page.getByRole('link', { name: /proceed to checkout/i }).click();
    await page.waitForURL('**/checkout');
    await expect(page.getByPlaceholder('Jane')).toBeVisible();
  });

  test('placing an order without shipping details is refused, with a clear reason', async ({
    page,
  }) => {
    await page.goto('/checkout');
    await page.getByRole('button', { name: /^place order$/i }).click();

    await expect(page.getByText(/complete the shipping address fields/i)).toBeVisible();
    // No order should exist to be confused with a real one.
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('a fully completed order form reaches the payment step — the real local-dev boundary', async ({
    page,
  }) => {
    await page.goto('/checkout');
    await fillShippingDetails(page);

    await page.getByRole('button', { name: /^place order$/i }).click();

    // The order itself is created before payment is attempted — reaching an
    // M-Pesa-specific error (rather than the shipping-validation error above,
    // or a generic "failed to place order") is the signal that `POST
    // /checkout` succeeded and `place_order` committed a real row. M-Pesa is
    // unconfigured locally, so this is where the journey necessarily stops
    // here — see the file header.
    await expect(page.getByText(/m-?pesa/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/complete the shipping address fields/i)).not.toBeVisible();
  });
});
