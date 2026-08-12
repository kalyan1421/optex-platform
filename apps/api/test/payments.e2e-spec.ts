import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Regression tests for the three payment defects found in the code review
 * (CODE-REVIEW C-1, C-2, C-3).
 *
 * All three shipped inside features already marked done, because nothing
 * tested them. These assert the behaviour rather than the implementation: a
 * forged callback must not credit an order, whatever the mechanism.
 *
 * The webhook is deliberately unauthenticated — that is the point. Anyone can
 * POST to it, so these run with no token at all.
 */
describe('Payments — forged callback regressions (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let orderId: string;
  let customerId: string;

  const CHECKOUT_ID = 'ws_CO_E2E_FORGERY_TEST';
  const ORDER_NUMBER = 'E2E-FORGE-1';
  const TOTAL_KES = 11900;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );

    const { data: customer } = await db.from('customers').select('id').limit(1).single();
    customerId = customer!.id;
  });

  beforeEach(async () => {
    // A pending order with a pending STK transaction — the state an attacker
    // reaches by starting a real payment and simply not paying.
    //
    // Clear the transactions first: they hold an FK to `orders`, so deleting
    // the order while they exist fails and the re-insert then collides on the
    // unique order_number. Match on order_id rather than mpesa_ref, because a
    // successful callback swaps mpesa_ref to the real M-Pesa receipt.
    const { data: stale } = await db
      .from('orders')
      .select('id')
      .eq('order_number', ORDER_NUMBER)
      .maybeSingle();
    if (stale) {
      await db.from('mpesa_transactions').delete().eq('order_id', stale.id);
      await db.from('orders').delete().eq('id', stale.id);
    }

    const { data: order } = await db
      .from('orders')
      .insert({
        customer_id: customerId,
        order_number: ORDER_NUMBER,
        subtotal_kes: 10000,
        vat_kes: 1600,
        shipping_kes: 300,
        total_kes: TOTAL_KES,
        status: 'pending_payment',
        payment_status: 'pending',
        payment_method: 'mpesa',
        shipping: {},
      })
      .select('id')
      .single();
    orderId = order!.id;

    await db.from('mpesa_transactions').insert({
      mpesa_ref: CHECKOUT_ID,
      amount_kes: TOTAL_KES,
      order_id: orderId,
      status: 'pending',
      raw: { CheckoutRequestID: CHECKOUT_ID },
    });
  });

  afterAll(async () => {
    await db.from('mpesa_transactions').delete().eq('order_id', orderId);
    await db.from('orders').delete().eq('order_number', ORDER_NUMBER);
    await app.close();
  });

  async function orderState() {
    const { data } = await db
      .from('orders')
      .select('payment_status, status')
      .eq('id', orderId)
      .single();
    return data!;
  }

  function postCallback(stkCallback: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/webhooks/mpesa')
      .send({ Body: { stkCallback } })
      .expect(201); // always acked, so Daraja stops retrying
  }

  // ── C-1 ──────────────────────────────────────────────────────────────────
  it('does not credit an order when a success callback carries no amount', async () => {
    await postCallback({
      CheckoutRequestID: CHECKOUT_ID,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
    });

    const order = await orderState();
    expect(order.payment_status).toBe('pending');
    expect(order.status).toBe('pending_payment');

    const { data: tx } = await db
      .from('mpesa_transactions')
      .select('status, raw')
      .eq('mpesa_ref', CHECKOUT_ID)
      .single();
    expect(tx!.status).toBe('pending');
    expect((tx!.raw as Record<string, unknown>).stage).toBe('amount_missing');
  });

  it('does not credit an order when the paid amount is short', async () => {
    await postCallback({
      CheckoutRequestID: CHECKOUT_ID,
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1 }] },
    });

    const order = await orderState();
    expect(order.payment_status).toBe('pending');
  });

  it('credits the order when the callback is genuine and the amount matches', async () => {
    await postCallback({
      CheckoutRequestID: CHECKOUT_ID,
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: TOTAL_KES },
          { Name: 'MpesaReceiptNumber', Value: 'E2ERECEIPT1' },
          { Name: 'PhoneNumber', Value: 254700000000 },
        ],
      },
    });

    const order = await orderState();
    expect(order.payment_status).toBe('paid');
  });

  // ── C-2 ──────────────────────────────────────────────────────────────────
  it('rejects a CheckoutRequestID containing PostgREST filter syntax', async () => {
    // Under the old `.or()` interpolation this could rewrite the filter and
    // match a transaction that was never the caller's.
    await postCallback({
      CheckoutRequestID: `${CHECKOUT_ID},mpesa_ref.neq.zzz`,
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: { Item: [{ Name: 'Amount', Value: TOTAL_KES }] },
    });

    const order = await orderState();
    expect(order.payment_status).toBe('pending');
  });

  // ── C-3 ──────────────────────────────────────────────────────────────────
  it('does not expose place_order to anon or authenticated callers', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { error } = await anon.rpc('place_order', {
      p_customer_id: customerId,
      p_payment_method: 'mpesa',
      p_shipping: {},
      p_delivery_option: 'delivery',
      p_promo_code: null,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permission denied/i);
  });
});
