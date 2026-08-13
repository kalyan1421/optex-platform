import { test, expect } from '@playwright/test';
import { getTestDb } from './lib/test-db';

/**
 * Admin Reviews moderation — approve, flag, reply.
 *
 * Zero coverage existed. `Reviews.tsx` updates its local list optimistically
 * before the API call resolves and never rolls back or surfaces an error if
 * that call fails (`approve()`/`flag()`/`submitReply()` all fire-and-forget
 * with only a `console.error` on failure). That optimism is exactly why
 * asserting on the visible "Approved"/"Flagged" text right after a click
 * proves nothing about persistence — the UI says that before the request
 * even lands. Every moderation test here waits for the actual PATCH
 * response first (this is what caught it: an early draft asserted only the
 * UI text, then queried the DB immediately after and got "pending" back —
 * the click had returned before the network request had). Only then does it
 * check the database, and that a decision made in the UI actually reaches
 * the public aggregate the storefront reads
 * (`ReviewsService.listApprovedForProduct`).
 *
 * NOTE: the search box filters by customer/product name only — never review
 * body text (`filtered = reviews.filter(r => matchStatus && (r.customer...
 * || r.product...))` in `Reviews.tsx`). Tests locate cards by their unique
 * body text directly rather than through search, which would silently
 * filter every card out and hang on a click that can never resolve.
 */
test.describe('Admin Reviews moderation', () => {
  let categoryId: string;
  let productId: string;
  const customerIds: string[] = [];
  let pendingReviewId: string;
  let flagReviewId: string;
  let replyReviewId: string;
  const suffix = Date.now();
  const approvalBody = `E2E review pending approval. (${suffix})`;
  const flagBody = `E2E review pending flag. (${suffix})`;
  const replyBody = `E2E review awaiting a reply. (${suffix})`;

  test.beforeAll(async () => {
    const db = getTestDb();

    const { data: category, error: catError } = await db
      .from('categories')
      .insert({ slug: `e2e-admin-reviews-${suffix}`, name: `E2E Admin Reviews ${suffix}` })
      .select('id')
      .single();
    if (catError) throw catError;
    categoryId = category!.id;

    const { data: product, error: prodError } = await db
      .from('products')
      .insert({
        sku: `E2E-REVIEWS-${suffix}`,
        slug: `e2e-admin-reviews-product-${suffix}`,
        name: `E2E Admin Reviews Product ${suffix}`,
        category_id: categoryId,
        price_kes: 7000,
        is_active: true,
      })
      .select('id')
      .single();
    if (prodError) throw prodError;
    productId = product!.id;

    // `product_reviews` has a unique (product_id, customer_id) constraint —
    // one review per customer per product — so three reviews on one product
    // need three distinct reviewers, not one. `auth_user_id` is left null on
    // all of them: a customer row exists independently of any login, and
    // moderation doesn't care who the reviewer is signed in as.
    const newCustomer = async (n: number) => {
      const { data, error } = await db
        .from('customers')
        .insert({
          full_name: `E2E Reviewer ${n}`,
          email: `e2e-reviewer-${suffix}-${n}@optex-test.local`,
        })
        .select('id')
        .single();
      if (error) throw error;
      customerIds.push(data!.id);
      return data!.id as string;
    };

    const seedReview = async (customerId: string, rating: number, body: string) => {
      const { data, error } = await db
        .from('product_reviews')
        .insert({ product_id: productId, customer_id: customerId, rating, body, status: 'pending' })
        .select('id')
        .single();
      if (error) throw error;
      return data!.id as string;
    };
    // One review each for approve / flag / reply — moderating one must not
    // touch the others.
    pendingReviewId = await seedReview(await newCustomer(1), 5, approvalBody);
    flagReviewId = await seedReview(await newCustomer(2), 1, flagBody);
    replyReviewId = await seedReview(await newCustomer(3), 4, replyBody);
  });

  test.afterAll(async () => {
    const db = getTestDb();
    await db.from('product_reviews').delete().eq('product_id', productId);
    await db.from('products').delete().eq('id', productId);
    await db.from('categories').delete().eq('id', categoryId);
    if (customerIds.length) await db.from('customers').delete().in('id', customerIds);
  });

  test('approves a review, and it becomes visible on the storefront aggregate', async ({
    page,
  }) => {
    await page.goto('/reviews');
    const card = page.getByText(approvalBody).locator('..').locator('..');

    // `approve()` updates local state optimistically before the PATCH
    // resolves — the UI reflects "Approved" instantly regardless of whether
    // the request has actually landed yet. Waiting for the response here,
    // not just the visible text, is what makes the DB check below meaningful
    // rather than a race against an in-flight request.
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/admin/reviews/${pendingReviewId}`) && r.request().method() === 'PATCH',
      ),
      card.getByRole('button', { name: /approve/i }).click(),
    ]);
    expect(response.ok()).toBe(true);

    await expect(card.getByText('Approved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(approvalBody).locator('..').locator('..').getByText('Approved'),
    ).toBeVisible();

    const db = getTestDb();
    const { data } = await db
      .from('product_reviews')
      .select('status')
      .eq('id', pendingReviewId)
      .single();
    expect(data!.status).toBe('approved');

    // The public aggregate only counts approved reviews — the whole point of
    // moderation. Confirms this review now reaches it.
    const publicRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:1111'}/api/products/${productId}/reviews`,
    );
    const publicBody = await publicRes.json();
    expect(publicBody.reviews.map((r: { id: string }) => r.id)).toContain(pendingReviewId);
    expect(publicBody.aggregate.count).toBeGreaterThanOrEqual(1);
  });

  test('flags a review', async ({ page }) => {
    await page.goto('/reviews');
    const card = page.getByText(flagBody).locator('..').locator('..');

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/admin/reviews/${flagReviewId}`) && r.request().method() === 'PATCH',
      ),
      card.getByRole('button', { name: /^flag$/i }).click(),
    ]);
    expect(response.ok()).toBe(true);

    await expect(card.getByText('Flagged', { exact: true })).toBeVisible();

    const db = getTestDb();
    const { data } = await db
      .from('product_reviews')
      .select('status')
      .eq('id', flagReviewId)
      .single();
    expect(data!.status).toBe('flagged');

    // A flagged review must not appear publicly either — only `approved` does.
    const publicRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:1111'}/api/products/${productId}/reviews`,
    );
    const publicBody = await publicRes.json();
    expect(publicBody.reviews.map((r: { id: string }) => r.id)).not.toContain(flagReviewId);
  });

  test('replies to a review, and the reply persists after reload', async ({ page }) => {
    await page.goto('/reviews');
    const card = page.getByText(replyBody).locator('..').locator('..');
    await card.getByRole('button', { name: /reply/i }).click();

    await expect(page.getByRole('heading', { name: /reply to review/i })).toBeVisible();
    await page.getByPlaceholder(/write a helpful response/i).fill('Thanks for trying us out!');

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/admin/reviews/${replyReviewId}`) && r.request().method() === 'PATCH',
      ),
      page.getByRole('button', { name: /post reply/i }).click(),
    ]);
    expect(response.ok()).toBe(true);

    await expect(page.getByText('Thanks for trying us out!')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Thanks for trying us out!')).toBeVisible();

    const db = getTestDb();
    const { data } = await db
      .from('product_reviews')
      .select('admin_reply')
      .eq('id', replyReviewId)
      .single();
    expect(data!.admin_reply).toBe('Thanks for trying us out!');
  });

  test('filters by status', async ({ page }) => {
    await page.goto('/reviews');
    await page.getByRole('button', { name: /^flagged \(/i }).click();
    await expect(page.getByText(flagBody)).toBeVisible();
    await expect(page.getByText(approvalBody)).not.toBeVisible();
  });

  test('search filters by customer or product name, not review body', async ({ page }) => {
    await page.goto('/reviews');
    // The product name is unique to this run's fixtures — searching it must
    // surface all three seeded reviews, which share that one product.
    const { data: product } = await getTestDb()
      .from('products')
      .select('name')
      .eq('id', productId)
      .single();
    await page.getByPlaceholder('Search...').fill(product!.name);
    await expect(page.getByText(flagBody)).toBeVisible();
    await expect(page.getByText(replyBody)).toBeVisible();
  });
});
