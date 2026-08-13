import { test, expect } from '@playwright/test';
import { getTestDb } from './lib/test-db';

/**
 * Admin Payments — manual reconcile (`POST /admin/payments/:id/link`).
 *
 * The read side (the "Needs attention" tab, paid-and-cancelled + reversed
 * transactions) is covered by `orders.spec.ts`'s last test. This covers the
 * write side: linking an orphan M-Pesa transaction to an order by number,
 * which the service does as one operation — set `order_id`, flip the
 * transaction to `matched`, and credit the order (`payment_status = 'paid'`)
 * — not three separate steps an admin could leave half-done.
 */
test.describe('Admin Payments — reconcile', () => {
  let customerId: string;
  const orderIds: Record<string, string> = {};
  const txIds: Record<string, string> = {};
  const suffix = Date.now();

  async function seedOrder(orderNumber: string) {
    const db = getTestDb();
    const { data, error } = await db
      .from('orders')
      .insert({
        customer_id: customerId,
        order_number: orderNumber,
        subtotal_kes: 10000,
        vat_kes: 1600,
        shipping_kes: 300,
        total_kes: 11900,
        status: 'received',
        payment_status: 'pending',
        payment_method: 'mpesa',
        shipping: { name: 'E2E Payments Tester', city: 'Nairobi' },
      })
      .select('id')
      .single();
    if (error) throw error;
    orderIds[orderNumber] = data!.id;
  }

  async function seedUnmatchedTx(ref: string) {
    const db = getTestDb();
    const { data, error } = await db
      .from('mpesa_transactions')
      .insert({ mpesa_ref: ref, amount_kes: 11900, customer_phone: '0712345678' })
      .select('id')
      .single();
    if (error) throw error;
    txIds[ref] = data!.id;
  }

  test.beforeAll(async () => {
    const db = getTestDb();
    const { data: customer, error } = await db
      .from('customers')
      .insert({
        full_name: 'E2E Payments Tester',
        email: `e2e-payments-${suffix}@optex-test.local`,
      })
      .select('id')
      .single();
    if (error) throw error;
    customerId = customer!.id;

    await seedOrder(`E2E-PAY-MATCH-${suffix}`);
    await seedOrder(`E2E-PAY-NOMATCH-${suffix}`);
    await seedUnmatchedTx(`E2E-MPESA-OK-${suffix}`);
    await seedUnmatchedTx(`E2E-MPESA-BAD-${suffix}`);
  });

  test.afterAll(async () => {
    const db = getTestDb();
    await db
      .from('mpesa_transactions')
      .delete()
      .in('mpesa_ref', [`E2E-MPESA-OK-${suffix}`, `E2E-MPESA-BAD-${suffix}`]);
    for (const id of Object.values(orderIds)) {
      await db.from('orders').delete().eq('id', id);
    }
    await db.from('customers').delete().eq('id', customerId);
  });

  test('links an orphan transaction to an order, and credits it', async ({ page }) => {
    const ref = `E2E-MPESA-OK-${suffix}`;
    const orderNumber = `E2E-PAY-MATCH-${suffix}`;

    await page.goto('/payments');
    await page.getByRole('tab', { name: /m-pesa log/i }).click();

    const row = page.getByRole('row').filter({ hasText: ref });
    await row.getByRole('button', { name: /reconcile/i }).click();

    await expect(
      page.getByRole('heading', { name: /reconcile m-pesa transaction/i }),
    ).toBeVisible();
    await page.getByPlaceholder(/e\.g\. ord-00042/i).fill(orderNumber);
    await page.getByRole('button', { name: /link order/i }).click();

    await expect(
      page.getByRole('heading', { name: /reconcile m-pesa transaction/i }),
    ).not.toBeVisible();

    const linkedRow = page.getByRole('row').filter({ hasText: ref });
    await expect(linkedRow.getByText(orderNumber)).toBeVisible();
    // A linked row no longer offers Reconcile — there's nothing left to fix.
    await expect(linkedRow.getByRole('button', { name: /reconcile/i })).toHaveCount(0);

    const db = getTestDb();
    const { data: tx } = await db
      .from('mpesa_transactions')
      .select('order_id, status')
      .eq('mpesa_ref', ref)
      .single();
    expect(tx!.order_id).toBe(orderIds[orderNumber]);
    expect(tx!.status).toBe('matched');

    const { data: order } = await db
      .from('orders')
      .select('payment_status')
      .eq('id', orderIds[orderNumber])
      .single();
    expect(order!.payment_status).toBe('paid');
  });

  test('shows a clear error for an order number that does not exist, and leaves the transaction unmatched', async ({
    page,
  }) => {
    const ref = `E2E-MPESA-BAD-${suffix}`;

    await page.goto('/payments');
    await page.getByRole('tab', { name: /m-pesa log/i }).click();

    const row = page.getByRole('row').filter({ hasText: ref });
    await row.getByRole('button', { name: /reconcile/i }).click();
    await page.getByPlaceholder(/e\.g\. ord-00042/i).fill('NO-SUCH-ORDER-NUMBER');
    await page.getByRole('button', { name: /link order/i }).click();

    await expect(page.getByText(/not found/i)).toBeVisible();
    // The dialog stays open on failure — nothing was silently swallowed.
    await expect(
      page.getByRole('heading', { name: /reconcile m-pesa transaction/i }),
    ).toBeVisible();

    const db = getTestDb();
    const { data: tx } = await db
      .from('mpesa_transactions')
      .select('order_id, status')
      .eq('mpesa_ref', ref)
      .single();
    expect(tx!.order_id).toBeNull();
    expect(tx!.status).toBe('unmatched');
  });
});
