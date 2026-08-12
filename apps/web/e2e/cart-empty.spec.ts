import { test, expect } from '@playwright/test';

/**
 * An empty cart used to render the full two-column layout: a promo-code box
 * with nothing to discount, an order summary reading KSH 0.00, and a "Proceed
 * to Checkout" button that led to a checkout with nothing in it.
 */
test.describe('Empty cart', () => {
  test('offers a way forward instead of a checkout with nothing in it', async ({ page }) => {
    await page.goto('/cart');

    await expect(page.getByRole('heading', { name: /your cart is empty/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /browse the collection/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /book an eye test/i })).toBeVisible();

    // None of the full-cart furniture belongs here.
    await expect(page.getByRole('link', { name: /proceed to checkout/i })).toHaveCount(0);
    await expect(page.getByText(/have a promo code/i)).toHaveCount(0);
    await expect(page.getByText(/order summary/i)).toHaveCount(0);
  });

  test('the primary action reaches the shop', async ({ page }) => {
    await page.goto('/cart');
    await page.getByRole('link', { name: /browse the collection/i }).click();
    await page.waitForURL('**/shop');
    await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  });

  test('a cart with items still shows the full layout', async ({ page }) => {
    await page.goto('/shop');
    const href = await page.locator('a[href^="/product/"]').first().getAttribute('href');
    await page.goto(href!);
    const addToCart = page.getByRole('button', { name: /add to cart/i }).first();
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await page.waitForURL('**/cart');

    await expect(page.getByRole('heading', { name: /your cart is empty/i })).toHaveCount(0);
    await expect(page.getByText(/order summary/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /proceed to checkout/i })).toBeVisible();
    // Singular, not "1 items".
    await expect(page.getByText(/you have 1 item in your bag/i)).toBeVisible();
  });
});
