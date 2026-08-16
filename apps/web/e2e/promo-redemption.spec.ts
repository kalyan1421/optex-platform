import { test, expect, Page } from '@playwright/test';
import { getTestDb } from './lib/test-db';

/**
 * Promo-code redemption on the cart page — audit finding F-17.
 *
 * NOTE ON WHAT THIS IS TESTING. `cart/page.jsx`'s `applyPromo()` reads
 * `promo_codes` directly from Supabase with the anon key rather than going
 * through the API — the same class of direct-read bypass F-13 closed for
 * search and the branch locator, just not one this remediation pass touched.
 * It is not a write, and `place_order` independently re-validates and
 * reprices any code at actual checkout (confirmed by reading the RPC), so it
 * is a client-side preview rather than a trust boundary. That said, it is
 * worth fixing for consistency in a follow-up; this file tests the behaviour
 * as it exists today, not the architecture it should eventually have.
 *
 * Assertions tie the discount to whatever the cart's own numbers say rather
 * than a hardcoded expected total, so the test survives catalogue price
 * changes: apply a KNOWN FIXED-KES code, then assert
 * `totalAfter === totalBefore - discountAmount` from the page's own displayed
 * figures.
 */

const PROMO_CODE = `E2ETEST${Date.now()}`.toUpperCase();
const DISCOUNT_KES = 500;

function throwawayEmail(): string {
  return `promo-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function signUpFreshAccount(page: Page): Promise<void> {
  const email = throwawayEmail();
  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Promo E2E Tester');
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

/** Parses "KSH. 24,000.00" (or "KSH.\n24,000.00" — the amount sometimes wraps
 * onto its own line) out of an order-summary row's text content. */
function parseKes(text: string): number {
  const match = text.replace(/\s+/g, ' ').match(/([\d,]+\.\d{2})/);
  if (!match) throw new Error(`could not parse a KES amount out of: ${text}`);
  return Number(match[1].replace(/,/g, ''));
}

test.describe('Promo code redemption', () => {
  test.beforeAll(async () => {
    const db = getTestDb();
    const { error } = await db.from('promo_codes').insert({
      code: PROMO_CODE,
      discount_type: 'fixed',
      value: DISCOUNT_KES,
      is_active: true,
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    const db = getTestDb();
    await db.from('promo_codes').delete().eq('code', PROMO_CODE);
  });

  test('a valid code discounts the total by exactly its value', async ({ page }) => {
    await signUpFreshAccount(page);
    await addFirstProductToCart(page);

    const totalRow = page.getByText(/^total$/i).locator('..');
    const totalBefore = parseKes(await totalRow.innerText());

    await page.getByPlaceholder('Enter code').fill(PROMO_CODE.toLowerCase());
    await page.getByRole('button', { name: /^apply$/i }).click();

    await expect(page.getByText(`✓ ${PROMO_CODE} applied`)).toBeVisible();
    await expect(page.getByText(`Promo (${PROMO_CODE})`)).toBeVisible();

    const totalAfter = parseKes(await totalRow.innerText());
    expect(totalBefore - totalAfter).toBeCloseTo(DISCOUNT_KES, 2);
  });

  test('an unknown code is refused with a clear reason, not a silent no-op', async ({ page }) => {
    await signUpFreshAccount(page);
    await addFirstProductToCart(page);

    await page.getByPlaceholder('Enter code').fill('DOES-NOT-EXIST');
    await page.getByRole('button', { name: /^apply$/i }).click();

    await expect(page.getByText(/invalid or expired promo code/i)).toBeVisible();
  });

  test('a code can be removed and cleanly reapplied', async ({ page }) => {
    // NOT a test of applyPromo()'s `code === promoApplied` → "Code already
    // applied" branch — that branch is unreachable through this UI. The
    // applied-code chip REPLACES the text input once a code is active, so
    // there is no way to type the same code again without removing it first;
    // the guard exists for a code path the current markup cannot trigger.
    // What this verifies instead is the reachable neighbour: that remove-then-
    // reapply leaves the cart in a clean, working state rather than a stuck one.
    await signUpFreshAccount(page);
    await addFirstProductToCart(page);

    await page.getByPlaceholder('Enter code').fill(PROMO_CODE);
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(`✓ ${PROMO_CODE} applied`)).toBeVisible();

    // Scoped to the promo chip's own "Remove" — the cart line item has an
    // identically-labelled one that would otherwise be matched instead.
    const promoChip = page.getByText(`✓ ${PROMO_CODE} applied`).locator('..');
    await promoChip.getByRole('button', { name: /^remove$/i }).click();
    await page.getByPlaceholder('Enter code').fill(PROMO_CODE);
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(`✓ ${PROMO_CODE} applied`)).toBeVisible();
  });

  test('removing an applied code restores the pre-discount total', async ({ page }) => {
    await signUpFreshAccount(page);
    await addFirstProductToCart(page);

    const totalRow = page.getByText(/^total$/i).locator('..');
    const totalBefore = parseKes(await totalRow.innerText());

    await page.getByPlaceholder('Enter code').fill(PROMO_CODE);
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(`✓ ${PROMO_CODE} applied`)).toBeVisible();

    // Scoped to the promo chip's own "Remove" — the cart line item has an
    // identically-labelled one that would otherwise be matched instead.
    await page
      .getByText(`✓ ${PROMO_CODE} applied`)
      .locator('..')
      .getByRole('button', { name: /^remove$/i })
      .click();

    await expect(page.getByText(`✓ ${PROMO_CODE} applied`)).not.toBeVisible();
    const totalAfterRemove = parseKes(await totalRow.innerText());
    expect(totalAfterRemove).toBeCloseTo(totalBefore, 2);
  });
});
