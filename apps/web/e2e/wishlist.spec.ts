import { test, expect, Page } from '@playwright/test';

/**
 * Wishlist save / list / remove — audit finding F-17.
 *
 * SPEC-10's server-persisted wishlist (add, list, remove, and the signed-out
 * redirect-with-return-path behaviour in `WishlistToggle`) had no browser-level
 * test — only the API side (`apps/api/test/wishlist.e2e-spec.ts`) was covered.
 */

function throwawayEmail(): string {
  return `wishlist-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function signUpFreshAccount(page: Page): Promise<void> {
  const email = throwawayEmail();
  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Wishlist E2E Tester');
  await page.getByPlaceholder('john@example.com').fill(email);
  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill('TestPassword123!');
  await passwords.nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/profile', { timeout: 20_000 });
}

async function firstProductHref(page: Page): Promise<string> {
  await page.goto('/shop');
  const href = await page.locator('a[href^="/product/"]').first().getAttribute('href');
  if (!href) throw new Error('no product cards on /shop');
  return href;
}

test('saving from the PDP, then removing from /wishlist, round-trips correctly', async ({
  page,
}) => {
  await signUpFreshAccount(page);
  const productHref = await firstProductHref(page);

  await page.goto(productHref);
  const productName = await page.getByRole('heading', { level: 1 }).textContent();

  // The PDP uses the "inline" WishlistToggle variant — labelled text, not just
  // an icon — see WishlistToggle.jsx.
  const saveButton = page.getByRole('button', { name: /save to wishlist/i });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  // Toggling is optimistic but does hit the server; wait for the label to
  // flip before trusting the save happened.
  await expect(page.getByRole('button', { name: /remove from wishlist/i })).toBeVisible();

  await page.goto('/wishlist');
  await expect(page.getByText(/1 saved item/i)).toBeVisible();
  if (productName) {
    await expect(page.getByText(productName.trim())).toBeVisible();
  }

  await page.getByRole('button', { name: /^remove$/i }).click();

  await expect(page.getByText(/you have not saved anything yet/i)).toBeVisible();
  await expect(page.getByText(/0 saved items/i)).toBeVisible();
});

test('a signed-out click is not silently dropped — it redirects to login and back', async ({
  page,
}) => {
  const productHref = await firstProductHref(page);
  await page.goto(productHref);

  await page.getByRole('button', { name: /save to wishlist/i }).click();

  await page.waitForURL(/\/login\?redirect=/);
  const redirect = new URL(page.url()).searchParams.get('redirect');
  expect(redirect).toBe(productHref);
});

test('visiting /wishlist signed out offers a way to sign in, not a broken page', async ({
  page,
}) => {
  await page.goto('/wishlist');

  await expect(page.getByText(/sign in to see your saved frames/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute(
    'href',
    '/login?redirect=%2Fwishlist',
  );
});
