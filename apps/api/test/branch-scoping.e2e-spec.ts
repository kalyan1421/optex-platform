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
});
