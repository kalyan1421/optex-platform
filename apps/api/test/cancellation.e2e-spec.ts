import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Customer-requested order cancellation — SPEC-06 R1, R2.
 *
 * The client chose a request/approval workflow (CLIENT-ANSWERS B5): the
 * customer asks, an admin decides. These assert the customer half — that
 * eligibility is decided by the server, that an ineligible order cannot be
 * requested however the call is made, and that one customer cannot reach
 * another's order.
 */
describe('Order cancellation (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  let customerId: string;
  const orderIds: Record<string, string> = {};
  const emails: string[] = [];

  const PASSWORD = 'TestPassword123!';

  /** Sign a fresh account up through gotrue and return its access token. */
  async function newAccount(): Promise<{ token: string; email: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `cancel-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    emails.push(email);
    return { token: data.session!.access_token, email };
  }

  async function seedOrder(
    orderNumber: string,
    status: string,
    createdAt: string,
    paymentStatus = 'pending',
  ) {
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
        shipping: {},
        created_at: createdAt,
      })
      .select('id')
      .single();
    if (error) throw error;
    orderIds[orderNumber] = data!.id;
    return data!.id;
  }

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

    // A real super_admin, promoted through the admin API. The roles guard
    // verifies the token against Supabase rather than trusting its claims, so
    // a hand-minted JWT would not do — the role has to actually be on the user.
    const admin = await newAccount();
    const { data: adminUser } = await db.auth.admin.listUsers();
    const adminRow = adminUser.users.find((u) => u.email === admin.email);
    await db.auth.admin.updateUserById(adminRow!.id, {
      app_metadata: { role: 'super_admin' },
    });
    // Re-authenticate so the token carries the new role.
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: session } = await anon.auth.signInWithPassword({
      email: admin.email,
      password: PASSWORD,
    });
    adminToken = session.session!.access_token;

    // The signup trigger (0004) creates the customers row.
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('email', primary.email)
      .single();
    customerId = customer!.id;

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 3600_000).toISOString();
    await seedOrder('E2E-CANCEL-FRESH', 'received', now.toISOString());
    await seedOrder('E2E-CANCEL-OLD', 'received', twoDaysAgo);
    await seedOrder('E2E-CANCEL-SENT', 'dispatched', now.toISOString(), 'paid');
  });

  afterAll(async () => {
    for (const id of Object.values(orderIds)) {
      await db.from('order_cancellation_requests').delete().eq('order_id', id);
      await db.from('orders').delete().eq('id', id);
    }
    for (const email of emails) {
      const { data: c } = await db.from('customers').select('id').eq('email', email).maybeSingle();
      if (c) await db.from('customers').delete().eq('id', c.id);
    }
    await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('reports a recent, un-dispatched order as cancellable', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .set(auth(token))
      .expect(200);
    expect(res.body.canRequest).toBe(true);
    expect(res.body.ineligibleReason).toBeNull();
  });

  it('refuses an order older than the configured window', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-CANCEL-OLD']}/cancellation`)
      .set(auth(token))
      .expect(200);
    expect(res.body.canRequest).toBe(false);
    expect(res.body.ineligibleReason).toMatch(/within \d+ hours/i);
  });

  it('refuses a dispatched order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-CANCEL-SENT']}/cancellation`)
      .set(auth(token))
      .expect(200);
    expect(res.body.canRequest).toBe(false);
    expect(res.body.ineligibleReason).toMatch(/dispatched/i);
  });

  it('records a request as pending, and never tells the customer it is approved', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .set(auth(token))
      .send({ reason: 'Ordered the wrong frame size' })
      .expect(201);

    expect(res.body.status).toBe('pending');
    expect(res.body.message).toMatch(/received/i);
    expect(res.body.message).not.toMatch(/cancelled|approved/i);

    // The order itself must not move until an admin decides.
    const { data: order } = await db
      .from('orders')
      .select('status')
      .eq('id', orderIds['E2E-CANCEL-FRESH'])
      .single();
    expect(order!.status).toBe('received');
  });

  it('rejects a duplicate request rather than creating a second row', async () => {
    await request(app.getHttpServer())
      .post(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .set(auth(token))
      .send({})
      .expect(409);

    const { data: rows } = await db
      .from('order_cancellation_requests')
      .select('id')
      .eq('order_id', orderIds['E2E-CANCEL-FRESH']);
    expect(rows).toHaveLength(1);
  });

  it('refuses a request on a dispatched order even when posted directly', async () => {
    // Eligibility is the server's decision — hiding the button is not the control.
    await request(app.getHttpServer())
      .post(`/api/orders/${orderIds['E2E-CANCEL-SENT']}/cancellation`)
      .set(auth(token))
      .send({})
      .expect(400);
  });

  it("does not expose another customer's order", async () => {
    await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .set(auth(otherToken))
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .set(auth(otherToken))
      .send({})
      .expect(404);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get(`/api/orders/${orderIds['E2E-CANCEL-FRESH']}/cancellation`)
      .expect(401);
  });
  describe('admin approval workflow (R3)', () => {
    it('refuses a customer on every admin route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/cancellations')
        .set(auth(otherToken))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/cancellations/pending-count')
        .set(auth(otherToken))
        .expect(403);
    });

    it('lists a request with the context needed to decide it', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/cancellations?status=pending')
        .set(auth(adminToken))
        .expect(200);

      const row = res.body.find(
        (r: { order_id: string }) => r.order_id === orderIds['E2E-CANCEL-FRESH'],
      );
      expect(row).toBeDefined();
      // Everything an admin needs without opening the order.
      expect(row.orderNumber).toBe('E2E-CANCEL-FRESH');
      expect(row.paymentStatus).toBe('pending');
      expect(row.orderStatus).toBe('received');
      expect(row.reason).toMatch(/wrong frame size/i);
      expect(row.movedSinceRequest).toBe(false);
    });

    it('will not approve a paid order without an explicit acknowledgement', async () => {
      const paidId = await seedOrder(
        'E2E-CANCEL-PAID',
        'received',
        new Date().toISOString(),
        'paid',
      );
      const { data: req } = await db
        .from('order_cancellation_requests')
        .insert({
          order_id: paidId,
          customer_id: customerId,
          status_at_request: 'received',
        })
        .select('id')
        .single();

      // Client policy is "no refunds", so this has to be a deliberate act.
      const refused = await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${req!.id}/approve`)
        .set(auth(adminToken))
        .send({})
        .expect(400);
      expect(refused.body.message).toMatch(/does not refund/i);

      // The order must not have moved.
      const { data: still } = await db.from('orders').select('status').eq('id', paidId).single();
      expect(still!.status).toBe('received');

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${req!.id}/approve`)
        .set(auth(adminToken))
        .send({ acknowledgePaid: true })
        .expect(200);
    });

    it('approving cancels the order; the same request cannot be decided twice', async () => {
      const { data: req } = await db
        .from('order_cancellation_requests')
        .select('id')
        .eq('order_id', orderIds['E2E-CANCEL-FRESH'])
        .single();

      const res = await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${req!.id}/approve`)
        .set(auth(adminToken))
        .send({})
        .expect(200);
      expect(res.body.status).toBe('approved');

      const { data: order } = await db
        .from('orders')
        .select('status')
        .eq('id', orderIds['E2E-CANCEL-FRESH'])
        .single();
      expect(order!.status).toBe('cancelled');

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${req!.id}/approve`)
        .set(auth(adminToken))
        .send({})
        .expect(409);
    });

    it('declining records the reason and leaves the order where it was', async () => {
      const declineId = await seedOrder(
        'E2E-CANCEL-DECLINE',
        'processing',
        new Date().toISOString(),
      );
      const { data: req } = await db
        .from('order_cancellation_requests')
        .insert({
          order_id: declineId,
          customer_id: customerId,
          status_at_request: 'processing',
        })
        .select('id')
        .single();

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${req!.id}/decline`)
        .set(auth(adminToken))
        .send({ reason: 'Frames already picked and packed.' })
        .expect(200);

      const { data: row } = await db
        .from('order_cancellation_requests')
        .select('status, decline_reason, decided_by, decided_at')
        .eq('id', req!.id)
        .single();
      expect(row!.status).toBe('declined');
      expect(row!.decline_reason).toMatch(/picked and packed/i);
      // R3: every decision is attributable.
      expect(row!.decided_by).toBeTruthy();
      expect(row!.decided_at).toBeTruthy();

      // Declining means nothing changed.
      const { data: order } = await db.from('orders').select('status').eq('id', declineId).single();
      expect(order!.status).toBe('processing');
    });
  });
});
