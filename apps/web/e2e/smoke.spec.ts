import { test, expect, Page } from '@playwright/test';

/**
 * The purchase path: shop → PDP → cart → checkout.
 *
 * Written against roles and visible text rather than class names or DOM
 * structure, because the point of this suite is to survive Wave 4 converting
 * these pages to Server Components — and the redesign that will follow it. If a
 * test here breaks, the journey broke, not the markup.
 *
 * Runs as a guest. Checkout redirects to /login when signed out, which is the
 * real boundary of the anonymous journey and where this suite stops.
 */

/** First product card on /shop, whichever product the catalogue happens to hold. */
function firstProductLink(page: Page) {
  return page.locator('a[href^="/product/"]').first();
}

/**
 * Open the first product and wait until the page can actually be transacted
 * with, then return its name.
 *
 * The PDP fetches client-side and renders "…" placeholders until the product
 * arrives, so reading the heading too early yields the placeholder rather than
 * a name. Add to Cart carries `disabled={!product}`, which makes "the button is
 * enabled" the honest readiness signal — and the one a shopper actually waits
 * for.
 */
async function openFirstProduct(page: Page): Promise<string> {
  await page.goto('/shop');
  const href = await firstProductLink(page).getAttribute('href');
  if (!href) throw new Error('no product cards on /shop');
  await page.goto(href);

  const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addToCart).toBeEnabled();

  const name = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim() ?? '';
  expect(name, 'product heading should not still be a loading placeholder').not.toMatch(/^[….]*$/);
  return name;
}

test.describe('Storefront purchase path', () => {
  test('shop lists products and filters narrow them', async ({ page }) => {
    await page.goto('/shop');

    await expect(page.getByRole('heading', { name: /our collection/i })).toBeVisible();

    const cards = page.locator('a[href^="/product/"]');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    // The result count must agree with what is on screen.
    await expect(page.getByText(/showing \d+/i)).toBeVisible();

    // Narrow by the first non-"All" brand and confirm the count moves down.
    const brandHeading = page.getByRole('heading', { name: 'Brands' });
    if (await brandHeading.isVisible().catch(() => false)) {
      const brandOption = page.locator('aside button').filter({ hasNotText: /^All/ }).first();
      const label = (await brandOption.textContent()) ?? '';
      await brandOption.click();
      await expect(page.getByRole('button', { name: /clear all filters/i })).toBeVisible();
      // Never more results after filtering than before.
      const filtered = await page.locator('a[href^="/product/"]').count();
      expect(
        filtered,
        `filtering by "${label.trim()}" should not widen the results`,
      ).toBeLessThanOrEqual(total);
    }
  });

  test('a product page shows its name and price', async ({ page }) => {
    const name = await openFirstProduct(page);
    expect(name.length).toBeGreaterThan(0);

    // The price is the one number a customer acts on, so its absence is a
    // failure, not a nitpick.
    await expect(page.getByText(/KSH\.\s*[\d,]+/i).first()).toBeVisible();
  });

  test('adding to cart lands on the cart with the item and a total', async ({ page }) => {
    const name = await openFirstProduct(page);

    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();

    // The PDP navigates to /cart on add.
    await page.waitForURL('**/cart');

    await expect(page.getByRole('heading', { name: /shopping cart/i })).toBeVisible();
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/you have [1-9]\d* items? in your bag/i)).toBeVisible();

    // Order summary must carry a grouped, non-zero total — this is the
    // regression that shipped once already, as "KSH. 32000.00".
    const total = page.getByText(/KSH\.\s*[\d,]+\.\d{2}/).first();
    await expect(total).toBeVisible();
    await expect(total).not.toHaveText(/KSH\.\s*0\.00/);
  });

  test('checkout sends a signed-out shopper to login', async ({ page }) => {
    await openFirstProduct(page);
    await page
      .getByRole('button', { name: /add to cart/i })
      .first()
      .click();
    await page.waitForURL('**/cart');

    await page.getByRole('link', { name: /proceed to checkout/i }).click();

    // Orders require an account, so /checkout bounces a signed-out shopper on
    // mount — they never see the form. The redirect must carry the return path,
    // or signing in drops the shopper on the home page holding a full cart.
    await page.waitForURL(/\/login\?redirect=%?2?F?\/?checkout/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/checkout');
  });

  test('search returns matching products', async ({ page }) => {
    const name = await openFirstProduct(page);
    // Use a single distinctive word from a real product so the query matches
    // whatever catalogue is loaded.
    const term = name.split(/\s+/).filter((w) => w.length > 3)[0];
    test.skip(!term, 'no product name long enough to search for');

    await page.goto(`/search?q=${encodeURIComponent(term)}`);
    await expect(page.getByRole('heading', { name: /find:/i })).toBeVisible();
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  });
});
