import { test, expect, Page } from '@playwright/test';

/**
 * The same frame in two colours must stay two cart lines.
 *
 * The PDP's colour picker sends a per-line `lensOption` with add-to-cart, and
 * the API keys a cart line on (product, lens_option) so two configurations of
 * one frame do not collapse into a single line with quantity 2. That only
 * holds if the browser actually SENDS the configuration — the value was being
 * dropped on the way to `api.cart.addItem`, so the server saw two identical
 * adds and merged them.
 *
 * Both paths are covered because they fail differently. The guest cart merges
 * locally and needs the variant in the line's id — storing both under the raw
 * product id gave them the same id, so quantity and remove acted on whichever
 * came first. The account cart merges server-side and needs the lensOption to
 * survive the request.
 */
function throwawayEmail(): string {
  return `cart-variants-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function signUpFreshAccount(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Cart Variants Tester');
  await page.getByPlaceholder('john@example.com').fill(throwawayEmail());
  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill('TestPassword123!');
  await passwords.nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/profile', { timeout: 20_000 });
}

/**
 * Opens the first product and adds it in the given frame colour.
 *
 * The swatch is addressed by its exact accessible name. A loose match picks up
 * other controls on the page — the first attempt used `/blue/i` and clicked
 * something else entirely, so both adds went in as the default black and the
 * test "passed" the wrong thing at the API.
 */
async function addInColour(page: Page, colour: 'Black' | 'Blue'): Promise<void> {
  await page.goto('/shop');
  await page.locator('a[href^="/product/"]').first().click();
  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addToCart).toBeEnabled();

  const swatch = page.getByRole('button', { name: `${colour} frame color` });
  await swatch.click();
  await expect(swatch).toHaveAttribute('aria-pressed', 'true');

  await addToCart.click();
  // The add is a round-trip for a signed-in shopper; let the server cart come
  // back before navigating away.
  await page.waitForTimeout(900);
}

test('a guest keeps two colours of the same frame as two lines', async ({ page }) => {
  await addInColour(page, 'Black');
  await addInColour(page, 'Blue');

  await page.goto('/cart');
  // The account cart arrives from the API, so the list is briefly empty on
  // first paint. Wait for a line to exist before counting — otherwise this
  // reads zero and reports it as a merge failure.
  await expect(page.locator('text=/^Frame: /').first()).toBeVisible();
  const variants = await page.locator('text=/^Frame: /').allInnerTexts();
  expect(new Set(variants).size).toBe(2);
});

test('a signed-in shopper keeps two colours of the same frame as two lines', async ({ page }) => {
  await signUpFreshAccount(page);
  await addInColour(page, 'Black');
  await addInColour(page, 'Blue');

  await page.goto('/cart');
  // The account cart arrives from the API, so the list is briefly empty on
  // first paint. Wait for a line to exist before counting — otherwise this
  // reads zero and reports it as a merge failure.
  await expect(page.locator('text=/^Frame: /').first()).toBeVisible();
  const variants = await page.locator('text=/^Frame: /').allInnerTexts();
  expect(
    new Set(variants).size,
    'the API keys a line on (product, lens_option) — one line means the configuration never reached it',
  ).toBe(2);
});
