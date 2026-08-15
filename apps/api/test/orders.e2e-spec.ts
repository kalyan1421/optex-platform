import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Order history, detail and tracking — `GET /orders`, `GET /orders/:id`,
 * `GET /orders/:id/tracking`.
 *
 * Both read paths here shipped with real, silent bugs found earlier this
 * session and already fixed in `orders.service.ts`: `/profile` order history
 * filtered `customer_id` by the **auth user id** rather than the resolved
 * `customers.id`, so it never showed anyone an order; the tracking query
 * selected `orders.shipping_address`, a column that does not exist, so
 * PostgREST rejected the whole select and every order came back "not found".
 * Neither had a test protecting the fix from regressing — these do.
 */
describe('Order history, detail and tracking (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let customerId: string;
  const orderIds: Record<string, string> = {};
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  /**
   * Capturing `id` (not just `email`) is what lets `afterAll` delete the
   * `auth.users` row directly — `customers.auth_user_id` cascades, so a
   * customer row deleted only by email lookup was leaving the auth user
   * itself behind on every run.
   */
  async function newAccount(): Promise<{ token: string; email: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `orders-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email };
  }

  async function seedOrder(
    orderNumber: string,
    status: string,
    paymentStatus = 'paid',
  ): Promise<string> {
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
        // The exact column the tracking-page bug selected instead of this one
        // (`shipping_address`) does not exist — this insert would itself fail
        // if that regression ever came back to the schema.
        shipping: { name: 'E2E Tester', city: 'Nairobi' },
      })
      .select('id')
      .single();
    if (error) throw error;
    orderIds[orderNumber] = data!.id;
    return data!.id;
  }

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

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

    const primary = await newAccount();
    token = primary.token;
    const other = await newAccount();
    otherToken = other.token;

    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('email', primary.email)
      .single();
    customerId = customer!.id;

    await seedOrder('E2E-ORDERS-RECEIVED', 'received');
    await seedOrder('E2E-ORDERS-DISPATCHED', 'dispatched');
    await seedOrder('E2E-ORDERS-CANCELLED', 'cancelled');
  });

  afterAll(async () => {
    for (const id of Object.values(orderIds)) {
      await db.from('orders').delete().eq('id', id);
    }
    // orders.customer_id has no ON DELETE CASCADE — must be gone before
    // deleting the auth user, or the cascade to `customers` 409s.
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('requires authentication for every route in this module', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
    await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}/tracking`)
      .expect(401);
  });

  describe('order history — the /profile customer_id bug', () => {
    it('lists the caller’s own orders, not empty and not someone else’s', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/orders')
        .set(auth(token))
        .expect(200);

      // The bug filtered on the auth user id, which never matches a
      // `customer_id` column — the list came back empty for every customer,
      // always, silently. Asserting non-empty is the whole regression check.
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      const numbers = res.body.data.map((o: { orderNumber: string }) => o.orderNumber);
      expect(numbers).toEqual(
        expect.arrayContaining([
          'E2E-ORDERS-RECEIVED',
          'E2E-ORDERS-DISPATCHED',
          'E2E-ORDERS-CANCELLED',
        ]),
      );
    });

    it('shows a different signed-in customer an empty list, not someone else’s orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/orders')
        .set(auth(otherToken))
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('order detail', () => {
    it('returns full detail for the caller’s own order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}`)
        .set(auth(token))
        .expect(200);

      expect(res.body.orderNumber).toBe('E2E-ORDERS-RECEIVED');
      expect(Number(res.body.totalKes)).toBe(11900);
    });

    it('404s on another customer’s order rather than exposing it', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}`)
        .set(auth(otherToken))
        .expect(404);
    });

    it('404s on a well-formed but nonexistent order id', async () => {
      await request(app.getHttpServer())
        .get('/api/orders/00000000-0000-0000-0000-000000000000')
        .set(auth(token))
        .expect(404);
    });
  });

  describe('tracking — the shipping_address column bug', () => {
    it('returns the tracking timeline for a received order, not "not found"', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}/tracking`)
        .set(auth(token))
        .expect(200);

      expect(res.body.orderNumber).toBe('E2E-ORDERS-RECEIVED');
      const received = res.body.stages.find((s: { key: string }) => s.key === 'received');
      const dispatched = res.body.stages.find((s: { key: string }) => s.key === 'dispatched');
      expect(received.completed).toBe(true);
      expect(received.current).toBe(true);
      expect(dispatched.completed).toBe(false);
    });

    it('lights every stage up to and including the current one for a dispatched order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-DISPATCHED']}/tracking`)
        .set(auth(token))
        .expect(200);

      const byKey = Object.fromEntries(
        res.body.stages.map((s: { key: string; completed: boolean; current: boolean }) => [
          s.key,
          s,
        ]),
      );
      expect(byKey.received.completed).toBe(true);
      expect(byKey.processing.completed).toBe(true);
      expect(byKey.dispatched.completed).toBe(true);
      expect(byKey.dispatched.current).toBe(true);
      expect(byKey.delivered.completed).toBe(false);
    });

    it('lights no stage for a cancelled order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-CANCELLED']}/tracking`)
        .set(auth(token))
        .expect(200);

      for (const stage of res.body.stages as { completed: boolean; current: boolean }[]) {
        expect(stage.completed).toBe(false);
        expect(stage.current).toBe(false);
      }
    });

    it('404s tracking for another customer’s order', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderIds['E2E-ORDERS-RECEIVED']}/tracking`)
        .set(auth(otherToken))
        .expect(404);
    });
  });
});
