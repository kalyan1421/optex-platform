import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getTestDb, loadEnvLocal } from './lib/test-db';

/**
 * Admin Orders — status updates and the SPEC-06 R3 direct-cancel flow (the
 * phone-call path). Both are fully covered at the API layer
 * (`apps/api/test/cancellation.e2e-spec.ts`), but nothing had exercised the
 * actual admin UI: whether "Cancelled" genuinely no longer appears in the
 * status dropdown (it was removed specifically because that path had no
 * paid-order acknowledgement gate), whether the cancel panel's paid-order
 * warning renders when it should, and whether cancelling really lands on the
 * order list as "Cancelled" without a page reload.
 */
test.describe('Admin Orders', () => {
  let customerId: string;
  const orderIds: Record<string, string> = {};
  const email = `admin-e2e-orders-${Date.now()}@optex-test.local`;

  async function seedOrder(orderNumber: string, status: string, paymentStatus: string) {
    const db = getTestDb();
    await db.from('orders').delete().eq('order_number', orderNumber);
    const { data, error } = await db
      .from('orders')
      .insert({
        customer_id: customerId,
        order_number: orderNumber,
        subtotal_kes: 10000,
        vat_kes: 1600,
        shipping_kes: 300,
        total_kes: 11900,
        status,
        payment_status: paymentStatus,
        payment_method: 'mpesa',
        shipping: { name: 'Admin E2E Tester', city: 'Nairobi' },
      })
      .select('id')
      .single();
    if (error) throw error;
    orderIds[orderNumber] = data!.id;
  }

  test.beforeAll(async () => {
    loadEnvLocal();
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await anon.auth.signUp({ email, password: 'TestPassword123!' });
    if (error) throw error;

    const db = getTestDb();
    const { data: customer } = await db.from('customers').select('id').eq('email', email).single();
    customerId = customer!.id;

    await seedOrder('E2E-ADMIN-UNPAID', 'received', 'pending');
    await seedOrder('E2E-ADMIN-PAID', 'received', 'paid');
  });

  test.afterAll(async () => {
    const db = getTestDb();
    for (const id of Object.values(orderIds)) {
      await db.from('orders').delete().eq('id', id);
    }
    const { data: c } = await db.from('customers').select('id').eq('email', email).maybeSingle();
    if (c) await db.from('customers').delete().eq('id', c.id);
  });

  test('advances an order through the fulfilment workflow', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder('Search orders...').fill('E2E-ADMIN-UNPAID');
    await page.getByRole('row').filter({ hasText: 'E2E-ADMIN-UNPAID' }).getByRole('button').click();

    await expect(page.getByRole('heading', { name: /order e2e-admin-unpaid/i })).toBeVisible();

    const statusSelect = page.getByRole('combobox').filter({ hasText: 'Update status...' });
    await statusSelect.click();
    await page.getByRole('option', { name: 'Processing' }).click();
    await page.getByRole('button', { name: /^update$/i }).click();

    // A successful update resets the dropdown to its placeholder — that's
    // the signal to wait on, not the Update button's own enabled state
    // (which is correctly disabled again once nothing new is selected).
    await expect(page.getByText('Update status...')).toBeVisible();
    // The dialog's own "Close", not Radix's X icon — both are named "Close".
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();

    await expect(
      page.getByRole('row').filter({ hasText: 'E2E-ADMIN-UNPAID' }).getByText('Processing'),
    ).toBeVisible();
  });

  test('the status dropdown no longer offers "Cancelled" — R3/R5 closed the backdoor', async ({
    page,
  }) => {
    await page.goto('/orders');
    await page.getByPlaceholder('Search orders...').fill('E2E-ADMIN-UNPAID');
    await page.getByRole('row').filter({ hasText: 'E2E-ADMIN-UNPAID' }).getByRole('button').click();

    const statusSelect = page.getByRole('combobox').filter({ hasText: 'Update status...' });
    await statusSelect.click();
    await expect(page.getByRole('option', { name: 'Cancelled' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('cancels an unpaid order directly, with a reason, no acknowledgement needed', async ({
    page,
  }) => {
    await page.goto('/orders');
    await page.getByPlaceholder('Search orders...').fill('E2E-ADMIN-UNPAID');
    await page.getByRole('row').filter({ hasText: 'E2E-ADMIN-UNPAID' }).getByRole('button').click();

    await page.getByRole('button', { name: /cancel order/i }).click();
    await page
      .getByPlaceholder(/why is this order being cancelled/i)
      .fill('Customer called the branch and asked to cancel.');

    // Unpaid: no paid-order warning, and the confirm button says plain
    // "Cancel order", not the deliberate-acknowledgement wording.
    await expect(page.getByText(/does not refund the customer/i)).not.toBeVisible();
    const confirm = page.getByRole('button', { name: /^cancel order$/i }).last();
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page.getByRole('heading', { name: /order e2e-admin-unpaid/i })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(
      page.getByRole('row').filter({ hasText: 'E2E-ADMIN-UNPAID' }).getByText('Cancelled'),
    ).toBeVisible();
  });

  test('cancelling a paid order requires the explicit acknowledgement', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder('Search orders...').fill('E2E-ADMIN-PAID');
    await page.getByRole('row').filter({ hasText: 'E2E-ADMIN-PAID' }).getByRole('button').click();

    await page.getByRole('button', { name: /cancel order/i }).click();
    await page
      .getByPlaceholder(/why is this order being cancelled/i)
      .fill('Customer called, frame is out of stock.');

    // Paid: the warning renders, and the confirm button carries the
    // deliberate-acknowledgement wording rather than a plain "Cancel order".
    await expect(page.getByText(/does not refund the customer/i)).toBeVisible();
    const confirm = page.getByRole('button', { name: /i understand.*cancel the order/i });
    await confirm.click();

    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(
      page.getByRole('row').filter({ hasText: 'E2E-ADMIN-PAID' }).getByText('Cancelled'),
    ).toBeVisible();

    const db = getTestDb();
    const { data } = await db
      .from('orders')
      .select('status, notes')
      .eq('id', orderIds['E2E-ADMIN-PAID'])
      .single();
    expect(data!.status).toBe('cancelled');
    expect(data!.notes).toMatch(/out of stock/i);
  });

  test('a paid-and-cancelled order surfaces on the Payments "Needs attention" tab', async ({
    page,
  }) => {
    await page.goto('/payments');
    const tab = page.getByRole('tab', { name: /needs attention/i });
    await tab.click();
    await expect(page.getByText('E2E-ADMIN-PAID')).toBeVisible();
  });
});
