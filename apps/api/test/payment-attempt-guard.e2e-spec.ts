import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import {
  MpesaPushOutcomeUnknownException,
  MpesaService,
} from '../src/modules/payments/mpesa.service';
import { PesapalService } from '../src/modules/payments/pesapal.service';

// Initiation is throttled to 5/min per caller (audit A-03); these tests fire far
// more than that on purpose. Read per request, so setting it here is enough.
process.env.PAYMENT_INIT_RATE_LIMIT = '10000';

/**
 * Concurrent payment attempts on one order — SPEC-11 B-7.
 *
 * Before this, nothing bounded them. A second STK push for an order simply sent
 * a second prompt, and a customer who approved both was debited twice: the order
 * was credited once and the surplus sat matched-but-unapplied until an admin
 * reconciled it.
 *
 * These run REAL, concurrent HTTP requests through the whole app against a real
 * database — the race is between requests, so a fake of either side would prove
 * nothing. Only the two providers are faked, with counters, because "how many
 * prompts reached a handset" is exactly what is being asserted.
 */
jest.setTimeout(90_000);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('Payment attempt guard (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let ownerToken: string;
  let otherToken: string;
  let ownerCustomerId: string;

  const runId = `${Date.now()}`;
  const userIds: string[] = [];
  const orderIds: string[] = [];
  const PASSWORD = 'TestPassword123!';
  const PHONE_A = '0712345678'; // -> 254712345678
  const PHONE_B = '0722222222'; // -> 254722222222

  /** Counting stand-in for Daraja. */
  const mpesa = {
    calls: 0,
    delayMs: 0,
    mode: 'ok' as 'ok' | 'reject' | 'unknown',
    reset() {
      this.calls = 0;
      this.delayMs = 0;
      this.mode = 'ok';
    },
    isConfigured: () => true,
    stkQuery: async () => ({}),
    async stkPush() {
      this.calls += 1;
      const n = this.calls;
      if (this.delayMs) await sleep(this.delayMs);
      if (this.mode === 'reject')
        throw new ServiceUnavailableException('M-Pesa STK push failed: rejected');
      if (this.mode === 'unknown') throw new MpesaPushOutcomeUnknownException();
      return {
        MerchantRequestID: `mr-${runId}-${n}`,
        CheckoutRequestID: `ws_CO_GUARD_${runId}_${n}_${Math.random().toString(36).slice(2, 6)}`,
        ResponseCode: '0',
        ResponseDescription: 'Success',
        CustomerMessage: 'Enter your M-Pesa PIN',
      };
    },
  };

  /** Counting stand-in for Pesapal. */
  const pesapal = {
    calls: 0,
    delayMs: 0,
    reset() {
      this.calls = 0;
      this.delayMs = 0;
    },
    isConfigured: () => true,
    getTransactionStatus: async () => ({ status_code: 0 }),
    async submitOrder() {
      this.calls += 1;
      const n = this.calls;
      if (this.delayMs) await sleep(this.delayMs);
      return {
        order_tracking_id: `pp-guard-${runId}-${n}-${Math.random().toString(36).slice(2, 6)}`,
        merchant_reference: 'x',
        redirect_url: `https://pay.example/session/${runId}/${n}`,
        status: '200',
      };
    },
  };

  async function newAccount(): Promise<{ id: string; token: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `guard-e2e-${runId}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { id: data.user!.id, token: data.session!.access_token };
  }

  async function seedOrder(tag: string, customerId = ownerCustomerId): Promise<string> {
    const { data, error } = await db
      .from('orders')
      .insert({
        customer_id: customerId,
        order_number: `E2E-GUARD-${runId}-${tag}`,
        subtotal_kes: 10000,
        vat_kes: 1600,
        shipping_kes: 300,
        total_kes: 11900,
        status: 'pending_payment',
        payment_status: 'pending',
        payment_method: 'mpesa',
        shipping: {},
      })
      .select('id')
      .single();
    if (error) throw error;
    orderIds.push(data!.id);
    return data!.id;
  }

  const stk = (orderId: string, phone = PHONE_A, token = ownerToken) =>
    request(app.getHttpServer())
      .post('/api/payments/mpesa/stk-push')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId, phone });

  const card = (orderId: string, token = ownerToken) =>
    request(app.getHttpServer())
      .post('/api/payments/pesapal/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId });

  const mpesaRows = async (orderId: string) =>
    (
      await db
        .from('mpesa_transactions')
        .select('mpesa_ref, status, customer_phone')
        .eq('order_id', orderId)
    ).data ?? [];

  const pesapalRows = async (orderId: string) =>
    (
      await db
        .from('pesapal_transactions')
        .select('pesapal_order_id, status')
        .eq('order_id', orderId)
    ).data ?? [];

  const claimRow = async (orderId: string) =>
    (
      await db
        .from('payment_attempt_claims')
        .select('claimed_at')
        .eq('order_id', orderId)
        .maybeSingle()
    ).data;

  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MpesaService)
      .useValue(mpesa)
      .overrideProvider(PesapalService)
      .useValue(pesapal)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );

    const owner = await newAccount();
    ownerToken = owner.token;
    otherToken = (await newAccount()).token;

    const { data: customer, error } = await db
      .from('customers')
      .select('id')
      .eq('auth_user_id', owner.id)
      .single();
    if (error) throw error;
    ownerCustomerId = customer!.id;
  });

  beforeEach(() => {
    mpesa.reset();
    pesapal.reset();
  });

  afterAll(async () => {
    for (const id of orderIds) {
      await db.from('payment_attempt_claims').delete().eq('order_id', id);
      await db.from('mpesa_transactions').delete().eq('order_id', id);
      await db.from('pesapal_transactions').delete().eq('order_id', id);
      await db.from('orders').delete().eq('id', id);
    }
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await app.close();
  });

  // ── The race itself ────────────────────────────────────────────────────────

  describe('simultaneous requests', () => {
    it('five identical pushes put ONE prompt on the handset, and every caller gets its id', async () => {
      const orderId = await seedOrder('race-same');
      // Daraja is slow, so all five arrive while the first is still mid-call —
      // the case a check-then-insert guard loses.
      mpesa.delayMs = 700;

      const res = await Promise.all(Array.from({ length: 5 }, () => stk(orderId)));

      expect(res.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(mpesa.calls).toBe(1);
      // Every caller can poll the same prompt.
      expect(new Set(res.map((r) => r.body.checkoutRequestId)).size).toBe(1);
      expect(await mpesaRows(orderId)).toHaveLength(1);
      // ...and the reservation is gone: the recorded row carries the guard now.
      expect(await claimRow(orderId)).toBeNull();
    });

    it('pushes to two DIFFERENT numbers: one prompt goes out, the other caller is refused', async () => {
      const orderId = await seedOrder('race-diff');
      mpesa.delayMs = 700;

      const res = await Promise.all([stk(orderId, PHONE_A), stk(orderId, PHONE_B)]);

      expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(mpesa.calls).toBe(1);
      expect(await mpesaRows(orderId)).toHaveLength(1);

      const refused = res.find((r) => r.status === 409)!;
      // Names where the live prompt is, without giving the number away.
      expect(refused.body.message).toMatch(/already waiting on the number ending \d{3}/);
    });

    it('an M-Pesa push and a card request together: exactly one provider is called', async () => {
      const orderId = await seedOrder('race-rails');
      mpesa.delayMs = 700;
      pesapal.delayMs = 700;

      const res = await Promise.all([stk(orderId), card(orderId)]);

      expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(mpesa.calls + pesapal.calls).toBe(1);
      expect((await mpesaRows(orderId)).length + (await pesapalRows(orderId)).length).toBe(1);
    });

    it('two orders do not block each other', async () => {
      const a = await seedOrder('iso-a');
      const b = await seedOrder('iso-b');
      mpesa.delayMs = 400;

      const res = await Promise.all([stk(a), stk(b)]);

      expect(res.map((r) => r.status)).toEqual([201, 201]);
      expect(mpesa.calls).toBe(2);
    });
  });

  // ── One live attempt, then a second request ────────────────────────────────

  describe('a repeat request while an attempt is live', () => {
    it('to the same number is answered with the live prompt — no second prompt', async () => {
      const orderId = await seedOrder('repeat-stk');

      const first = await stk(orderId).expect(201);
      const second = await stk(orderId).expect(201);

      expect(second.body.checkoutRequestId).toBe(first.body.checkoutRequestId);
      expect(second.body.merchantRequestId).toBe(first.body.merchantRequestId);
      expect(mpesa.calls).toBe(1);
      expect(await mpesaRows(orderId)).toHaveLength(1);
    });

    it('for a card session returns the same redirect URL — no second session', async () => {
      const orderId = await seedOrder('repeat-card');

      const first = await card(orderId).expect(201);
      const second = await card(orderId).expect(201);

      expect(second.body.redirectUrl).toBe(first.body.redirectUrl);
      expect(second.body.orderTrackingId).toBe(first.body.orderTrackingId);
      expect(pesapal.calls).toBe(1);
      expect(await pesapalRows(orderId)).toHaveLength(1);
    });

    it('to a different number is refused, and sends nothing', async () => {
      const orderId = await seedOrder('other-number');
      await stk(orderId, PHONE_A).expect(201);

      const res = await stk(orderId, PHONE_B).expect(409);

      expect(res.body.message).toMatch(/already waiting/);
      expect(mpesa.calls).toBe(1);
    });

    it('for card is refused while an M-Pesa prompt is live', async () => {
      const orderId = await seedOrder('switch-to-card');
      await stk(orderId).expect(201);

      const res = await card(orderId).expect(409);

      expect(res.body.message).toMatch(/M-Pesa prompt/);
      expect(pesapal.calls).toBe(0);
    });

    it('for M-Pesa is refused while a card session is open', async () => {
      const orderId = await seedOrder('switch-to-mpesa');
      await card(orderId).expect(201);

      const res = await stk(orderId).expect(409);

      expect(res.body.message).toMatch(/card payment/i);
      expect(mpesa.calls).toBe(0);
    });
  });

  // ── When an attempt stops blocking ─────────────────────────────────────────

  describe('an attempt stops blocking', () => {
    it('once it has resolved: a failed prompt lets the customer retry at once', async () => {
      const orderId = await seedOrder('resolved');
      const first = await stk(orderId).expect(201);
      // What the callback, the status query or the polling job does.
      await db.from('mpesa_transactions').update({ status: 'failed' }).eq('order_id', orderId);

      const second = await stk(orderId).expect(201);

      expect(mpesa.calls).toBe(2);
      expect(second.body.checkoutRequestId).not.toBe(first.body.checkoutRequestId);
    });

    it('once it is older than the window', async () => {
      const orderId = await seedOrder('expired');
      await stk(orderId).expect(201);
      await db
        .from('mpesa_transactions')
        .update({ received_at: ago(91) })
        .eq('order_id', orderId);

      await stk(orderId).expect(201);

      expect(mpesa.calls).toBe(2);
    });

    it('but not while it is still inside the window', async () => {
      const orderId = await seedOrder('inside-window');
      await stk(orderId).expect(201);
      await db
        .from('mpesa_transactions')
        .update({ received_at: ago(80) })
        .eq('order_id', orderId);

      // Same number: replayed, not re-sent.
      await stk(orderId).expect(201);

      expect(mpesa.calls).toBe(1);
    });
  });

  // ── Failure: who may retry, and when ───────────────────────────────────────

  describe('when Daraja fails', () => {
    it('a plain refusal frees the order at once — nothing reached a handset', async () => {
      const orderId = await seedOrder('refused');
      mpesa.mode = 'reject';
      await stk(orderId).expect(503);
      expect(await claimRow(orderId)).toBeNull();

      mpesa.mode = 'ok';
      const t0 = Date.now();
      await stk(orderId).expect(201);

      // Immediate: it must not have waited out a claim.
      expect(Date.now() - t0).toBeLessThan(3_000);
      expect(mpesa.calls).toBe(2);
    });

    it('an unknown outcome keeps the order closed: the prompt may already be on the handset', async () => {
      const orderId = await seedOrder('unknown');
      mpesa.mode = 'unknown';

      const failed = await stk(orderId).expect(503);
      expect(failed.body.message).toMatch(/couldn't confirm that the M-Pesa prompt was sent/);
      // Reserved, and left to expire on its own.
      expect(await claimRow(orderId)).not.toBeNull();

      // An immediate retry — the panic tap. It waits for the reservation, then
      // is refused rather than sending a second prompt on top of a possible first.
      mpesa.mode = 'ok';
      const retry = await stk(orderId).expect(409);
      expect(retry.body.message).toMatch(/still being set up/);
      expect(mpesa.calls).toBe(1);

      // The reservation is not permanent: a process that died mid-call must not
      // wedge an order. Once it expires, the customer can pay.
      await db
        .from('payment_attempt_claims')
        .update({ claimed_at: ago(91) })
        .eq('order_id', orderId);
      await stk(orderId).expect(201);
      expect(mpesa.calls).toBe(2);
    });
  });

  // ── Access ─────────────────────────────────────────────────────────────────

  describe('access', () => {
    it("refuses someone else's order before anything is reserved", async () => {
      const orderId = await seedOrder('not-yours');

      await stk(orderId, PHONE_A, otherToken).expect(403);

      expect(mpesa.calls).toBe(0);
      expect(await claimRow(orderId)).toBeNull();
    });

    it('does not let a customer call the claim functions directly', async () => {
      const orderId = await seedOrder('rpc-lockout');

      // Reserving someone's order is a way to stop them paying for it.
      const asUser = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_ANON_KEY as string,
        {
          auth: { persistSession: false },
          global: { headers: { Authorization: `Bearer ${ownerToken}` } },
        },
      );
      const anon = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false } },
      );

      for (const client of [asUser, anon]) {
        const claim = await client.rpc('claim_payment_attempt', { p_order_id: orderId });
        expect(claim.error).not.toBeNull();
        expect(claim.data).toBeNull();

        const release = await client.rpc('release_payment_attempt', { p_order_id: orderId });
        expect(release.error).not.toBeNull();
      }

      expect(await claimRow(orderId)).toBeNull();
    });
  });
});
