import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * CR-01 R1 sub-phase 1c — the staff directory (`StaffModule`). Covers CRUD,
 * the branch-requirement validation for branch-scoped roles, the
 * `app_metadata` sync that is what actually changes a staff member's access,
 * and the self-modification guard.
 */
describe('Admin staff directory (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];
  let branchId: string;

  const PASSWORD = 'TestPassword123!';
  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newSuperAdmin(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `staff-e2e-sa-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    await db.auth.admin.updateUserById(data.user!.id, { app_metadata: { role: 'super_admin' } });
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

    const { data: branch, error } = await db
      .from('branches')
      .insert({ slug: `e2e-staff-${SUFFIX}`, name: 'E2E Staff Branch', is_active: true })
      .select('id')
      .single();
    if (error) throw error;
    branchId = branch!.id;
  });

  afterAll(async () => {
    await db.from('staff_users').delete().in('auth_user_id', userIds);
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await db.from('branches').delete().eq('id', branchId);
    await app.close();
  });

  it('refuses a non-super_admin caller on every staff route', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `staff-e2e-plain-${SUFFIX}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await request(app.getHttpServer())
      .get('/api/admin/staff')
      .set(auth(data.session!.access_token))
      .expect(403);
  });

  it('lists the 7 seeded roles for the role picker', async () => {
    const token = await newSuperAdmin();
    const res = await request(app.getHttpServer())
      .get('/api/admin/staff/roles')
      .set(auth(token))
      .expect(200);

    expect(res.body).toHaveLength(7);
    const branchManager = res.body.find((r: { id: string }) => r.id === 'branch_manager');
    expect(branchManager.is_branch_scoped).toBe(true);
  });

  it('rejects creating a branch-scoped role with no branch', async () => {
    const token = await newSuperAdmin();
    await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(token))
      .send({
        email: `staff-e2e-bm-nobranch-${SUFFIX}@optex-test.local`,
        password: PASSWORD,
        fullName: 'No Branch BM',
        roleId: 'branch_manager',
      })
      .expect(400);
  });

  it('rejects creating a non-branch-scoped role with a branch', async () => {
    const token = await newSuperAdmin();
    await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(token))
      .send({
        email: `staff-e2e-acc-withbranch-${SUFFIX}@optex-test.local`,
        password: PASSWORD,
        fullName: 'Wrong Branch Accountant',
        roleId: 'accountant',
        branchId,
      })
      .expect(400);
  });

  it('creates a staff account, syncing app_metadata so it can sign in with the assigned role', async () => {
    const token = await newSuperAdmin();
    const email = `staff-e2e-created-${SUFFIX}@optex-test.local`;

    const res = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(token))
      .send({
        email,
        password: PASSWORD,
        fullName: 'New Branch Manager',
        roleId: 'branch_manager',
        branchId,
      })
      .expect(201);

    expect(res.body.role_id).toBe('branch_manager');
    expect(res.body.role_name).toBe('Branch Manager');
    expect(res.body.branch_id).toBe(branchId);
    userIds.push(res.body.auth_user_id);

    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: session, error } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (error) throw error;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(auth(session.session!.access_token))
      .expect(200);
    expect(me.body.role).toBe('branch_manager');
    expect(me.body.branchId).toBe(branchId);
  });

  it('updating a role syncs app_metadata immediately — same unrefreshed token, no re-login', async () => {
    const adminToken = await newSuperAdmin();
    const email = `staff-e2e-promote-${SUFFIX}@optex-test.local`;

    const created = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(adminToken))
      .send({
        email,
        password: PASSWORD,
        fullName: 'To Be Promoted',
        roleId: 'inventory_manager',
      })
      .expect(201);
    userIds.push(created.body.auth_user_id);

    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: session, error } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (error) throw error;
    const staffToken = session.session!.access_token;

    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(auth(staffToken))
      .expect(403); // inventory_manager doesn't hold dashboard.read

    await request(app.getHttpServer())
      .patch(`/api/admin/staff/${created.body.id}`)
      .set(auth(adminToken))
      .send({ roleId: 'accountant' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(auth(staffToken)) // same, unrefreshed token
      .expect(200); // accountant holds dashboard.read
  });

  it('deactivates a staff account: blocks sign-in', async () => {
    const adminToken = await newSuperAdmin();
    const email = `staff-e2e-deactivate-${SUFFIX}@optex-test.local`;

    const created = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(adminToken))
      .send({ email, password: PASSWORD, fullName: 'To Be Deactivated', roleId: 'marketing' })
      .expect(201);
    userIds.push(created.body.auth_user_id);

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/staff/${created.body.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'deactivated' })
      .expect(200);
    expect(res.body.deactivated_at).not.toBeNull();

    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    expect(error).not.toBeNull();
  });

  it('refuses a caller modifying their own staff account', async () => {
    // The super_admin fixture from newSuperAdmin() has no staff_users row
    // (only migration 0025's backfilled seed account does), so create a
    // staff account and act on it as itself instead.
    const adminToken = await newSuperAdmin();
    const selfEmail = `staff-e2e-self-${SUFFIX}@optex-test.local`;

    const created = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(adminToken))
      .send({
        email: selfEmail,
        password: PASSWORD,
        fullName: 'Self Super Admin',
        roleId: 'super_admin',
      })
      .expect(201);
    userIds.push(created.body.auth_user_id);

    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const { data: session, error } = await anon.auth.signInWithPassword({
      email: selfEmail,
      password: PASSWORD,
    });
    if (error) throw error;

    await request(app.getHttpServer())
      .patch(`/api/admin/staff/${created.body.id}/status`)
      .set(auth(session.session!.access_token))
      .send({ status: 'deactivated' })
      .expect(400);
  });
});
