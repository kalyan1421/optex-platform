import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * CR-01 R1 1d — the audit log. Verifies entries actually get recorded at a
 * real mutation site (staff creation — the highest-value one, per the R1
 * plan), that `audit_log.read` gates the viewer, and that the actor's role
 * is captured alongside the action.
 */
describe('Audit log (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function newSuperAdmin(): Promise<string> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `audit-e2e-sa-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
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
  });

  afterAll(async () => {
    await db.from('staff_users').delete().in('auth_user_id', userIds);
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('refuses a non-super_admin caller (audit_log.read is Super-Admin-only)', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `audit-e2e-plain-${SUFFIX}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    await request(app.getHttpServer())
      .get('/api/admin/audit-log')
      .set(auth(data.session!.access_token))
      .expect(403);
  });

  it('records an entry for a real mutation (staff.create) with the actor and role captured', async () => {
    const token = await newSuperAdmin();
    const email = `audit-e2e-target-${SUFFIX}@optex-test.local`;

    const created = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(token))
      .send({ email, password: PASSWORD, fullName: 'Audited Staff', roleId: 'marketing' })
      .expect(201);
    userIds.push(created.body.auth_user_id);

    const log = await request(app.getHttpServer())
      .get('/api/admin/audit-log')
      .set(auth(token))
      .query({ resourceType: 'staff_users', pageSize: 100 })
      .expect(200);

    const entry = log.body.data.find(
      (e: { resource_id: string; action: string }) =>
        e.resource_id === created.body.id && e.action === 'staff.create',
    );
    expect(entry).toBeDefined();
    expect(entry.actor_role).toBe('super_admin');
    expect(entry.after.email).toBe(email);
  });

  it('filters by actorUserId', async () => {
    const token = await newSuperAdmin();
    const email = `audit-e2e-filter-${SUFFIX}@optex-test.local`;

    const created = await request(app.getHttpServer())
      .post('/api/admin/staff')
      .set(auth(token))
      .send({ email, password: PASSWORD, fullName: 'Filter Target', roleId: 'accountant' })
      .expect(201);
    userIds.push(created.body.auth_user_id);

    const me = await request(app.getHttpServer()).get('/api/auth/me').set(auth(token)).expect(200);

    const log = await request(app.getHttpServer())
      .get('/api/admin/audit-log')
      .set(auth(token))
      .query({ actorUserId: me.body.id, resourceType: 'staff_users', pageSize: 100 })
      .expect(200);

    expect(log.body.data.length).toBeGreaterThan(0);
    expect(
      log.body.data.every((e: { actor_user_id: string }) => e.actor_user_id === me.body.id),
    ).toBe(true);
  });
});
