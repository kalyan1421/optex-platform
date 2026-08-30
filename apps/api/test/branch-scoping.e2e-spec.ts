import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * CR-01 R1 sub-phase 1b — branch scoping for inventory, appointments and
 * orders. Written red-then-green against `admin-inventory` first per the R1
 * plan (it was the most nakedly broken case: zero params, every branch
 * unconditionally) before the equivalent fixes on the other two surfaces.
 *
 * The load-bearing property under test throughout: a branch-scoped caller
 * (`app_metadata.branch_id` set) is scoped SERVER-SIDE. A client-supplied
 * value that names a different branch (a query param, a request body field)
 * is ignored or rejected — never trusted.
 */
describe('Branch scoping — inventory / appointments / orders (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];
  let branchA: string;
  let branchB: string;
  let productId: string;
  let customerAuthId: string;
  let customerId: string;

  const PASSWORD = 'TestPassword123!';
  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newBranchManager(branchId: string): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `branch-scoping-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await db.auth.admin.updateUserById(data.user!.id, {
      app_metadata: { role: 'branch_manager', branch_id: branchId },
    });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
    return session.session!.access_token;
  }

  /** A staff account with no `branch_id` — the unscoped control case. */
  async function newSuperAdmin(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `branch-scoping-sa-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await db.auth.admin.updateUserById(data.user!.id, {
      app_metadata: { role: 'super_admin' },
    });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
    return session.session!.access_token;
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

    const { data: branches, error: branchError } = await db
      .from('branches')
      .insert([
        { slug: `e2e-branch-scoping-a-${SUFFIX}`, name: 'E2E Branch A', is_active: true },
        { slug: `e2e-branch-scoping-b-${SUFFIX}`, name: 'E2E Branch B', is_active: true },
      ])
      .select('id');
    if (branchError) throw branchError;
    branchA = branches![0].id;
    branchB = branches![1].id;

    const { data: product, error: productError } = await db
      .from('products')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (productError) throw productError;
    productId = product!.id;

    await db.from('inventory').upsert([
      { product_id: productId, branch_id: branchA, stock: 10 },
      { product_id: productId, branch_id: branchB, stock: 20 },
    ]);

    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const customerEmail = `branch-scoping-customer-${SUFFIX}@optex-test.local`;
    const { data: customerAuth, error: customerError } = await anon.auth.signUp({
      email: customerEmail,
      password: PASSWORD,
    });
    if (customerError) throw customerError;
    customerAuthId = customerAuth.user!.id;
    userIds.push(customerAuthId);

    const { data: customerRow, error: customerRowError } = await db
      .from('customers')
      .select('id')
      .eq('auth_user_id', customerAuthId)
      .single();
    if (customerRowError) throw customerRowError;
    customerId = customerRow!.id;
  });

  afterAll(async () => {
    // Requests reference orders, so they go first.
    await db.from('order_cancellation_requests').delete().eq('customer_id', customerId);
    await db.from('orders').delete().in('branch_id', [branchA, branchB]);
    await db.from('appointments').delete().in('branch_id', [branchA, branchB]);
    await db
      .from('inventory')
      .delete()
      .eq('product_id', productId)
      .in('branch_id', [branchA, branchB]);
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await db.from('branches').delete().in('id', [branchA, branchB]);
    await app.close();
  });

  describe('inventory', () => {
    it("GET /admin/inventory returns only the Branch Manager's own branch — one column, their own stock", async () => {
      const token = await newBranchManager(branchA);
      const res = await request(app.getHttpServer())
        .get('/api/admin/inventory')
        .set(auth(token))
        .expect(200);

      expect(res.body.branches.map((b: { id: string }) => b.id)).toEqual([branchA]);
      const rows = res.body.items.filter((i: { product_id: string }) => i.product_id === productId);
      expect(rows).toHaveLength(1);
      expect(rows[0].branch_id).toBe(branchA);
      expect(rows[0].stock).toBe(10);
    });

    // R2 removed PATCH /admin/inventory entirely — stock is now derived from
    // the ledger (GRN/transfers/adjustments/counts), never set directly, and
    // `inventory.write` (the permission these two tests used to exercise) was
    // dropped from the matrix in migration 0026. Branch Manager holds none of
    // R2's new inventory.* permissions either (SPEC-08's own stories give
    // Branch Manager zero R2 write surface) — the previous branch-scoping
    // assertion for a stock write has no route left to make it against. That
    // coverage is superseded by rbac.e2e-spec.ts's permission-matrix checks.
    it('POST /admin/grn is refused to a Branch Manager — R2 gave them no inventory write surface', async () => {
      const token = await newBranchManager(branchA);
      await request(app.getHttpServer())
        .post('/api/admin/grn')
        .set(auth(token))
        .send({
          supplier_id: '00000000-0000-0000-0000-000000000000',
          branch_id: branchA,
          items: [{ product_id: productId, unit_cost_kes: 1000, quantity_ordered: 1 }],
        })
        .expect(403);
    });
  });

  describe('appointments', () => {
    it("GET /admin/appointments only returns the caller's branch, ignoring a client-supplied branchId for a different one", async () => {
      const { data: apptA, error: errA } = await db
        .from('appointments')
        .insert({
          customer_id: customerId,
          branch_id: branchA,
          type: 'eye_test',
          scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select('id')
        .single();
      if (errA) throw errA;
      const { data: apptB, error: errB } = await db
        .from('appointments')
        .insert({
          customer_id: customerId,
          branch_id: branchB,
          type: 'eye_test',
          scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select('id')
        .single();
      if (errB) throw errB;

      const token = await newBranchManager(branchA);
      const res = await request(app.getHttpServer())
        .get(`/api/admin/appointments?branchId=${branchB}`)
        .set(auth(token))
        .expect(200);

      const ids = res.body.map((a: { id: string }) => a.id);
      expect(ids).toContain(apptA!.id);
      expect(ids).not.toContain(apptB!.id);
    });
  });

  describe('orders', () => {
    async function newOrder(branchId: string): Promise<string> {
      const { data, error } = await db
        .from('orders')
        .insert({
          customer_id: customerId,
          branch_id: branchId,
          subtotal_kes: 1000,
          total_kes: 1000,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data!.id;
    }

    it("GET /admin/orders only returns the caller's branch", async () => {
      const orderA = await newOrder(branchA);
      const orderB = await newOrder(branchB);

      const token = await newBranchManager(branchA);
      const res = await request(app.getHttpServer())
        .get('/api/admin/orders?pageSize=100')
        .set(auth(token))
        .expect(200);

      const ids = res.body.data.map((o: { id: string }) => o.id);
      expect(ids).toContain(orderA);
      expect(ids).not.toContain(orderB);
    });

    it("GET /admin/orders/:id 404s for another branch's order rather than leaking it", async () => {
      const orderB = await newOrder(branchB);
      const token = await newBranchManager(branchA);
      await request(app.getHttpServer())
        .get(`/api/admin/orders/${orderB}`)
        .set(auth(token))
        .expect(404);
    });

    it("PATCH /admin/orders/:id/cancel 404s for another branch's order", async () => {
      const orderB = await newOrder(branchB);
      const token = await newBranchManager(branchA);
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${orderB}/cancel`)
        .set(auth(token))
        .send({ acknowledgePaid: true })
        .expect(404);

      const { data } = await db.from('orders').select('status').eq('id', orderB).single();
      expect(data!.status).toBe('pending_payment'); // unchanged
    });
  });

  /**
   * Audit A-01. `customers.read` is held by both branch-scoped roles, but the
   * list took no actor at all and returned every customer in the country with
   * name, email, phone and order history. A customer has no `branch_id`, so
   * the scope comes from their appointments — the only branch relationship
   * that exists today (`orders.branch_id` is never set by `place_order`).
   */
  describe('customers', () => {
    /**
     * A customer of its own rather than the shared `customerId`: the
     * appointments block above books that one at BOTH branches, so it is
     * legitimately visible to either manager and proves nothing here.
     */
    let scopedCustomerId: string;

    beforeAll(async () => {
      const anon = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false } },
      );
      const email = `branch-scoping-cust-a-${SUFFIX}@optex-test.local`;
      const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
      if (error) throw error;
      userIds.push(data.user!.id);

      const { data: row, error: rowError } = await db
        .from('customers')
        .select('id')
        .eq('auth_user_id', data.user!.id)
        .single();
      if (rowError) throw rowError;
      scopedCustomerId = row!.id;

      // Seen at branch A only.
      const { error: apptError } = await db.from('appointments').insert({
        customer_id: scopedCustomerId,
        branch_id: branchA,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (apptError) throw apptError;
    });

    it("GET /admin/customers only returns customers seen at the caller's branch", async () => {
      const tokenA = await newBranchManager(branchA);
      const resA = await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set(auth(tokenA))
        .expect(200);
      expect(resA.body.map((c: { id: string }) => c.id)).toContain(scopedCustomerId);

      const tokenB = await newBranchManager(branchB);
      const resB = await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set(auth(tokenB))
        .expect(200);
      expect(resB.body.map((c: { id: string }) => c.id)).not.toContain(scopedCustomerId);
    });

    it('keeps the scope under search, and never leaks the filter join', async () => {
      const tokenB = await newBranchManager(branchB);

      // Search must narrow within the branch, never escape it.
      const res = await request(app.getHttpServer())
        .get('/api/admin/customers?search=branch-scoping-cust-a')
        .set(auth(tokenB))
        .expect(200);
      expect(res.body.map((c: { id: string }) => c.id)).not.toContain(scopedCustomerId);

      // The `appointments` embed exists to filter and must not reach the client.
      for (const row of res.body) {
        expect(row).not.toHaveProperty('appointments');
      }
    });

    it('still returns the full directory for an unscoped Super Admin', async () => {
      const token = await newSuperAdmin();
      const res = await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set(auth(token))
        .expect(200);
      expect(res.body.map((c: { id: string }) => c.id)).toContain(scopedCustomerId);
      for (const row of res.body) {
        expect(row).not.toHaveProperty('appointments');
      }
    });
  });

  /**
   * Audit A-02. The cancellation-REQUEST workflow was unscoped on both the
   * read path (listing every branch's requests, with customer name, email and
   * phone embedded) and the write path — `approve()` checked payment status
   * but never branch, so a manager could cancel and restock another branch's
   * order.
   */
  describe('cancellation requests', () => {
    async function newRequestOn(branchId: string): Promise<{ orderId: string; requestId: string }> {
      const { data: order, error: orderError } = await db
        .from('orders')
        .insert({
          customer_id: customerId,
          branch_id: branchId,
          subtotal_kes: 1000,
          total_kes: 1000,
        })
        .select('id, status')
        .single();
      if (orderError) throw orderError;

      const { data: req, error: reqError } = await db
        .from('order_cancellation_requests')
        .insert({
          order_id: order!.id,
          customer_id: customerId,
          reason: 'e2e branch scoping',
          status: 'pending',
          status_at_request: order!.status,
        })
        .select('id')
        .single();
      if (reqError) throw reqError;
      return { orderId: order!.id, requestId: req!.id };
    }

    it("GET /admin/cancellations only returns the caller's branch", async () => {
      const a = await newRequestOn(branchA);
      const b = await newRequestOn(branchB);

      const token = await newBranchManager(branchA);
      const res = await request(app.getHttpServer())
        .get('/api/admin/cancellations')
        .set(auth(token))
        .expect(200);

      const ids = res.body.map((r: { id: string }) => r.id);
      expect(ids).toContain(a.requestId);
      expect(ids).not.toContain(b.requestId);
    });

    it('the pending-count badge agrees with the list it links to', async () => {
      const token = await newBranchManager(branchA);
      const listRes = await request(app.getHttpServer())
        .get('/api/admin/cancellations?status=pending')
        .set(auth(token))
        .expect(200);
      const countRes = await request(app.getHttpServer())
        .get('/api/admin/cancellations/pending-count')
        .set(auth(token))
        .expect(200);

      expect(countRes.body.count).toBe(listRes.body.length);
    });

    it("PATCH /admin/cancellations/:id/approve 404s for another branch, and does not cancel the order", async () => {
      const b = await newRequestOn(branchB);
      const token = await newBranchManager(branchA);

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${b.requestId}/approve`)
        .set(auth(token))
        .send({ acknowledgePaid: true })
        .expect(404);

      const { data: order } = await db.from('orders').select('status').eq('id', b.orderId).single();
      expect(order!.status).toBe('pending_payment');
      const { data: req } = await db
        .from('order_cancellation_requests')
        .select('status')
        .eq('id', b.requestId)
        .single();
      expect(req!.status).toBe('pending');
    });

    it("PATCH /admin/cancellations/:id/decline 404s for another branch", async () => {
      const b = await newRequestOn(branchB);
      const token = await newBranchManager(branchA);

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${b.requestId}/decline`)
        .set(auth(token))
        .send({ reason: 'should never apply' })
        .expect(404);

      const { data: req } = await db
        .from('order_cancellation_requests')
        .select('status')
        .eq('id', b.requestId)
        .single();
      expect(req!.status).toBe('pending');
    });

    it('a caller in the right branch can still decide the request', async () => {
      const a = await newRequestOn(branchA);
      const token = await newBranchManager(branchA);

      await request(app.getHttpServer())
        .patch(`/api/admin/cancellations/${a.requestId}/decline`)
        .set(auth(token))
        .send({ reason: 'out of the return window' })
        .expect(200);

      const { data: req } = await db
        .from('order_cancellation_requests')
        .select('status')
        .eq('id', a.requestId)
        .single();
      expect(req!.status).toBe('declined');
    });
  });
});
