import { test, expect, Page } from '@playwright/test';

/**
 * The guest cart must survive sign-in.
 *
 * Orders require an account, so a shopper who fills a cart signed out has to
 * sign in to check out. Before the merge landed, that sign-in replaced local
 * state with the (empty) server cart and the guest lines were silently gone —
 * losing the order at the last step, on the one journey where the cart matters
 * most.
 *
 * Signs up a fresh account per run rather than reusing a fixture, because the
 * bug only appears on the guest → authenticated transition. A pre-authenticated
 * session cannot exercise it.
 */

/** Unique per run so repeated runs do not collide on the email. */
function throwawayEmail(): string {
  return `cart-merge-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function addFirstProductToCart(page: Page): Promise<string> {
  await page.goto('/shop');
  const href = await page.locator('a[href^="/product/"]').first().getAttribute('href');
  if (!href) throw new Error('no product cards on /shop');
  await page.goto(href);

  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addToCart).toBeEnabled();
  const name = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim() ?? '';

  await addToCart.click();
  await page.waitForURL('**/cart');
  await expect(page.getByText(/you have [1-9]\d* items? in your bag/i)).toBeVisible();
  return name;
}

test('a guest cart survives signing up', async ({ page }) => {
  const productName = await addFirstProductToCart(page);
  const email = throwawayEmail();

  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Cart Merge Test');
  await page.getByPlaceholder('john@example.com').fill(email);
  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill('TestPassword123!');
  await passwords.nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();

  await page.getByRole('button', { name: /create account/i }).click();

  // Signup lands on /profile once the session is live.
  await page.waitForURL('**/profile', { timeout: 20_000 });

  await page.goto('/cart');

  // The line the shopper chose as a guest is still there, now owned by the
  // account — and exactly once, not doubled by a re-fired merge.
  await expect(page.getByText(productName, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/you have 1 items? in your bag/i)).toBeVisible();
});
