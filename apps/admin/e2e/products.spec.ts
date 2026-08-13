import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getTestDb, loadEnvLocal } from './lib/test-db';

/**
 * Admin Products — CRUD through the real UI, plus the image-upload endpoint.
 *
 * The endpoint is real and API-client-typed (`POST /api/products/:id/images`,
 * `api.admin.products.uploadImage` — see `products.controller.ts`), but
 * `Products.tsx`'s form has no file picker; the only image field is a plain
 * "Image URL" text input. There is no UI path to exercise upload from a
 * browser. Rather than skip it or pretend it doesn't exist, this file tests
 * it the way it actually works today: called directly, authenticated the
 * same way the admin UI's own fetch layer would be. That gap — a working,
 * typed endpoint nothing in the UI ever calls — is itself worth surfacing,
 * not silently worked around.
 */
test.describe('Admin Products', () => {
  const productSku = `E2E-PROD-${Date.now()}`;
  const productName = `E2E Admin Test Frame ${Date.now()}`;
  let categoryId: string;
  let categoryName: string;
  let createdProductId: string;

  test.beforeAll(async () => {
    const db = getTestDb();
    categoryName = `E2E Admin Category ${Date.now()}`;
    const { data, error } = await db
      .from('categories')
      .insert({ slug: `e2e-admin-products-${Date.now()}`, name: categoryName })
      .select('id')
      .single();
    if (error) throw error;
    categoryId = data!.id;
  });

  test.afterAll(async () => {
    const db = getTestDb();
    if (createdProductId) {
      // Storage objects the upload test wrote aren't referenced anywhere
      // else once the product row is gone; harmless to leave in the bucket
      // for a throwaway local-dev run, but the row itself should not linger.
      await db.from('products').delete().eq('id', createdProductId);
    }
    await db.from('products').delete().eq('sku', productSku);
    await db.from('categories').delete().eq('id', categoryId);
  });

  test('requires name, SKU and category before submitting', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /add product/i }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add Product', exact: true })
      .click();
    await expect(page.getByText(/name, sku and category are required/i)).toBeVisible();
  });

  test('creates a product, and it appears in the list and search', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /add product/i }).click();

    await page.getByLabel(/product name/i).fill(productName);
    await page.getByLabel(/^sku/i).fill(productSku);
    // The "Category *" label has no `htmlFor` — it sits above a Radix
    // Select trigger, not a native input — so `getByLabel` can't find it.
    await page.getByRole('combobox').filter({ hasText: 'Select category' }).click();
    await page.getByRole('option', { name: categoryName }).click();
    await page.getByLabel(/price \(kes\)/i).fill('15000');

    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Add Product', exact: true })
      .click();

    // The dialog closes on success — a lingering dialog means the create
    // failed silently rather than actually landing.
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.getByPlaceholder(/search by name, sku, brand/i).fill(productSku);
    const row = page.getByRole('row').filter({ hasText: productSku });
    await expect(row).toBeVisible();
    await expect(row.getByText(productName)).toBeVisible();
    await expect(row.getByText('15,000')).toBeVisible();
    await expect(row.getByText('Active')).toBeVisible();

    const db = getTestDb();
    const { data } = await db.from('products').select('id').eq('sku', productSku).single();
    createdProductId = data!.id;
  });

  test('edits a product, and the change persists after reload', async ({ page }) => {
    await page.goto('/products');
    await page.getByPlaceholder(/search by name, sku, brand/i).fill(productSku);

    const row = page.getByRole('row').filter({ hasText: productSku });
    await row.getByRole('button').nth(1).click(); // Eye, Edit, Trash — Edit is the second icon

    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible();
    const priceInput = page.getByLabel(/price \(kes\)/i);
    await priceInput.fill('');
    await priceInput.fill('18500');
    await page.getByLabel(/brand/i).fill('E2E Test Brand');
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Reload rather than trusting only the in-memory state update — proves
    // the edit actually persisted server-side, not just in the React tree.
    await page.reload();
    await page.getByPlaceholder(/search by name, sku, brand/i).fill(productSku);
    const updatedRow = page.getByRole('row').filter({ hasText: productSku });
    await expect(updatedRow.getByText('18,500')).toBeVisible();
    await expect(updatedRow.getByText('E2E Test Brand')).toBeVisible();
  });

  test('deactivates a product — a soft delete, not a removal from the admin list', async ({
    page,
  }) => {
    page.once('dialog', (dialog) => dialog.accept());

    await page.goto('/products');
    await page.getByPlaceholder(/search by name, sku, brand/i).fill(productSku);
    const row = page.getByRole('row').filter({ hasText: productSku });
    await row.getByRole('button').nth(2).click(); // Trash is the third icon

    await expect(row.getByText('Inactive')).toBeVisible();

    // Still visible to the admin — `remove()` flips `is_active`, it never
    // deletes the row, so order-item history stays intact.
    await page.reload();
    await page.getByPlaceholder(/search by name, sku, brand/i).fill(productSku);
    await expect(page.getByRole('row').filter({ hasText: productSku })).toBeVisible();

    const db = getTestDb();
    const { data } = await db.from('products').select('is_active').eq('sku', productSku).single();
    expect(data!.is_active).toBe(false);
  });

  test('uploads a product image via the API endpoint the UI never calls', async () => {
    loadEnvLocal();
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const db = getTestDb();

    const email = `admin-e2e-upload-${Date.now()}@optex-test.local`;
    const password = 'TestPassword123!';
    const { data: signUpData, error: signUpError } = await anon.auth.signUp({ email, password });
    if (signUpError) throw signUpError;
    await db.auth.admin.updateUserById(signUpData.user!.id, {
      app_metadata: { role: 'super_admin' },
    });
    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;

    // A minimal but structurally real PNG (1x1, transparent) — the service
    // has no content validation, but a real signature is more honest than
    // an arbitrary byte string claiming to be one.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:1111';
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'frame.png');

    const res = await fetch(`${apiUrl}/api/products/${createdProductId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session!.access_token}` },
      body: form,
    });
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.url).toMatch(/^https?:\/\/.*product-images.*/);
    expect(body.product.images).toContain(body.url);

    const { data: product } = await db
      .from('products')
      .select('images')
      .eq('id', createdProductId)
      .single();
    expect(product!.images).toContain(body.url);
  });
});
