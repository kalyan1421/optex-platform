import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * CR-01 R1 (RBAC) — the permission engine and route cutover (migration 0025,
 * `PermissionsGuard`/`@RequirePermission`, replacing `RolesGuard`/`@Roles`).
 *
 * The 157-test suite everywhere else already proves `super_admin` behaviour
 * is unchanged by the cutover (it holds all 25 permissions, same as it held
 * the one role before). What that suite CANNOT prove is that the matrix
 * itself is enforced — that a role with 10 permissions doesn't quietly get
 * the other 15, and that a role change takes effect without a token refresh.
 * That is what this file covers.
 */
describe('RBAC — permission matrix enforcement (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  async function newStaffAccount(roleId: string): Promise<{ token: string; authUserId: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `rbac-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    const authUserId = data.user!.id;
    userIds.push(authUserId);

    await db.auth.admin.updateUserById(authUserId, { app_metadata: { role: roleId } });

    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signInError) throw signInError;
    return { token: session.session!.access_token, authUserId };
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
  });

  afterAll(async () => {
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('grants a route to a role that holds the required permission', async () => {
    // branch_manager holds appointments.read (migration 0025's seeded matrix).
    const { token } = await newStaffAccount('branch_manager');
    await request(app.getHttpServer()).get('/api/admin/appointments').set(auth(token)).expect(200);
  });

  it('refuses a role that does not hold the required permission — not a widened grant', async () => {
    // branch_manager does NOT hold dashboard.read in R1 (no branch-attribution
    // rule for revenue exists yet — that's R4). A leaky guard would show up
    // here as a 200, not a 403.
    const { token } = await newStaffAccount('branch_manager');
    await request(app.getHttpServer()).get('/api/admin/dashboard').set(auth(token)).expect(403);
  });

  it('a role with zero granted permissions (doctor) is refused everywhere it is tried', async () => {
    const { token } = await newStaffAccount('doctor');
    await request(app.getHttpServer()).get('/api/admin/appointments').set(auth(token)).expect(403);
    await request(app.getHttpServer()).get('/api/admin/dashboard').set(auth(token)).expect(403);
    await request(app.getHttpServer()).get('/api/admin/inventory').set(auth(token)).expect(403);
  });

  it('refuses a caller with no staff role at all (a plain customer token)', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `rbac-e2e-customer-${Date.now()}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await request(app.getHttpServer())
      .get('/api/admin/appointments')
      .set(auth(data.session!.access_token))
      .expect(403);
  });

  it("GET /auth/me returns the caller's branch and its full, server-computed permission set", async () => {
    const { token } = await newStaffAccount('inventory_manager');
    const res = await request(app.getHttpServer()).get('/api/auth/me').set(auth(token)).expect(200);

    expect(res.body.role).toBe('inventory_manager');
    expect(res.body.branchId).toBeNull();
    expect(res.body.permissions.sort()).toEqual(
      ['products.read', 'inventory.read', 'inventory.write', 'branches.read'].sort(),
    );
  });

  it('a role change takes effect on the very next request — no token refresh required', async () => {
    // Empirically confirmed this session against the running stack:
    // `verifyAccessToken()` calls `supabase.auth.getUser(token)`, a LIVE
    // GoTrue lookup on every request rather than a cached JWT decode, so
    // `app_metadata` edits are visible immediately. This is the load-bearing
    // property that lets 1c's StaffModule promise "no re-login needed" —
    // pinned here as a permanent regression test rather than folklore.
    const { token, authUserId } = await newStaffAccount('doctor');

    await request(app.getHttpServer()).get('/api/admin/inventory').set(auth(token)).expect(403);

    await db.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: 'inventory_manager' },
    });

    // Same, unrefreshed access token — no new sign-in.
    await request(app.getHttpServer()).get('/api/admin/inventory').set(auth(token)).expect(200);
  });
});
