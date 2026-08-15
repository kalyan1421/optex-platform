import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Admin customer directory — `GET /admin/customers`, `PATCH /admin/customers/:id`.
 *
 * The mutation is the part that matters: deactivating a customer (MISSING_FEATURES
 * A-5, previously a disabled "Coming soon" menu item with no backend at all) has
 * to actually block sign-in, not just flip a display flag — so this suite proves
 * the ban round-trips through the real Supabase Admin API, not only that
 * `deactivated_at` gets written.
 */
describe('Admin customers (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let otherToken: string;
  let adminToken: string;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  async function newAccount(): Promise<{ token: string; email: string; id: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `customers-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email, id: data.user!.id };
  }

  /** Resolves `customers.id` from the auth user id — the endpoint under test keys off it, not the auth id. */
  async function resolveCustomerId(authUserId: string): Promise<string> {
    const { data } = await db
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single<{ id: string }>();
    return data!.id;
  }

  async function canSignIn(email: string): Promise<boolean> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    return !error;
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

    const other = await newAccount();
    otherToken = other.token;

    const admin = await newAccount();
    const { data: adminUsers } = await db.auth.admin.listUsers();
    const adminRow = adminUsers.users.find((u) => u.email === admin.email);
    await db.auth.admin.updateUserById(adminRow!.id, { app_metadata: { role: 'super_admin' } });
    const anonForAdmin = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: adminSession } = await anonForAdmin.auth.signInWithPassword({
      email: admin.email,
      password: PASSWORD,
    });
    adminToken = adminSession.session!.access_token;
  });

  afterAll(async () => {
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('refuses a non-admin on every admin route', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/customers')
      .set(auth(otherToken))
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/customers/00000000-0000-0000-0000-000000000000')
      .set(auth(otherToken))
      .send({ status: 'deactivated' })
      .expect(403);
  });

  it('lists customers with their orders embedded', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/customers')
      .set(auth(adminToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('orders');
    expect(res.body[0]).toHaveProperty('deactivated_at');
  });

  it('404s setting status on a nonexistent customer', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/customers/00000000-0000-0000-0000-000000000000')
      .set(auth(adminToken))
      .send({ status: 'deactivated' })
      .expect(404);
  });

  it('rejects an invalid status value', async () => {
    const target = await newAccount();
    const customerId = await resolveCustomerId(target.id);

    await request(app.getHttpServer())
      .patch(`/api/admin/customers/${customerId}`)
      .set(auth(adminToken))
      .send({ status: 'banned' })
      .expect(400);
  });

  it('deactivates a customer: blocks sign-in and is reflected in the admin list', async () => {
    const target = await newAccount();
    const customerId = await resolveCustomerId(target.id);

    expect(await canSignIn(target.email)).toBe(true);

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/customers/${customerId}`)
      .set(auth(adminToken))
      .send({ status: 'deactivated' })
      .expect(200);

    expect(res.body.deactivated_at).not.toBeNull();
    expect(await canSignIn(target.email)).toBe(false);

    const list = await request(app.getHttpServer())
      .get('/api/admin/customers')
      .set(auth(adminToken))
      .expect(200);
    const row = list.body.find((c: { id: string }) => c.id === customerId);
    expect(row.deactivated_at).not.toBeNull();
  });

  it('reactivates a customer: restores sign-in and clears deactivated_at', async () => {
    const target = await newAccount();
    const customerId = await resolveCustomerId(target.id);

    await request(app.getHttpServer())
      .patch(`/api/admin/customers/${customerId}`)
      .set(auth(adminToken))
      .send({ status: 'deactivated' })
      .expect(200);
    expect(await canSignIn(target.email)).toBe(false);

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/customers/${customerId}`)
      .set(auth(adminToken))
      .send({ status: 'active' })
      .expect(200);

    expect(res.body.deactivated_at).toBeNull();
    expect(await canSignIn(target.email)).toBe(true);
  });

  it('setting a customer to its current status is a no-op that still returns 200', async () => {
    const target = await newAccount();
    const customerId = await resolveCustomerId(target.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/customers/${customerId}`)
      .set(auth(adminToken))
      .send({ status: 'active' })
      .expect(200);
    expect(res.body.deactivated_at).toBeNull();
  });
});
