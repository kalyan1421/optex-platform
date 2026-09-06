import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Eye records — `POST/GET /eye-records`, `GET/PATCH /admin/eye-records`
 * (migration 0037).
 *
 * This is health data, so the guarantees under test are mostly about
 * containment: a customer never sees another customer's intake; an intake
 * cannot be attached to somebody else's appointment; and the storefront has
 * no route at all that edits a submitted record. Beyond that, the two
 * data-shape invariants the form depends on: blank prescription cells must
 * persist as NULL rather than 0 (a stored 0.00 is indistinguishable from a
 * real plano reading), and `reviewed_at`/`reviewed_by` must track `status`
 * so the three can never disagree.
 */
describe('Eye records (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  let branchId: string;
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  async function newAccount(): Promise<{ token: string; email: string; id: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `eyerec-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email, id: data.user!.id };
  }

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Minimal valid body — identity only, no prescription. */
  const baseBody = () => ({
    fullName: 'E2E Patient',
    phone: '+254700111222',
  });

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

    const { data: branch } = await db.from('branches').select('id').limit(1).single();
    branchId = branch!.id;
  });

  afterAll(async () => {
    // eye_records.customer_id cascades from customers, which cascades from
    // auth.users — deleting the users is enough.
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('rejects an unauthenticated submission', async () => {
    await request(app.getHttpServer()).post('/api/eye-records').send(baseBody()).expect(401);
  });

  it('creates a record from identity alone, with no prescription', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    expect(res.body.full_name).toBe('E2E Patient');
    expect(res.body.status).toBe('submitted');
    expect(res.body.conditions).toEqual([]);
    expect(res.body.appointment_id).toBeNull();
  });

  it('stores blank prescription cells as null, not zero', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), sphereOd: -1.25, pdOd: 31.5 })
      .expect(201);

    expect(Number(res.body.sphere_od)).toBe(-1.25);
    expect(Number(res.body.pd_od)).toBe(31.5);
    // Everything not sent stays null — a 0 here would read as a real plano Rx.
    expect(res.body.sphere_os).toBeNull();
    expect(res.body.add_od).toBeNull();
    expect(res.body.cyl_od).toBeNull();
    expect(res.body.axis_od).toBeNull();
  });

  it('persists the health-history checklist as an array', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), conditions: ['Diabetes', 'Glaucoma'] })
      .expect(201);

    expect(res.body.conditions).toEqual(['Diabetes', 'Glaucoma']);
  });

  it('rejects an out-of-range axis and an over-precise sphere', async () => {
    await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), axisOd: 181 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), sphereOd: -1.234 })
      .expect(400);
  });

  it('rejects a submission with no name or phone', async () => {
    await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ fullName: 'No Phone' })
      .expect(400);
  });

  it('links a record to the caller’s own appointment', async () => {
    const { data: appt } = await db
      .from('appointments')
      .insert({
        customer_id: (
          await db.from('customers').select('id').eq('auth_user_id', userIds[0]).single()
        ).data!.id,
        branch_id: branchId,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      })
      .select('id')
      .single();

    const res = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), appointmentId: appt!.id })
      .expect(201);

    expect(res.body.appointment_id).toBe(appt!.id);
  });

  it('refuses to attach an intake to another customer’s appointment', async () => {
    const { data: appt } = await db
      .from('appointments')
      .insert({
        customer_id: (
          await db.from('customers').select('id').eq('auth_user_id', userIds[1]).single()
        ).data!.id,
        branch_id: branchId,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + 8 * 864e5).toISOString(),
      })
      .select('id')
      .single();

    // 404 not 403: whether someone else's appointment exists is not the
    // caller's business.
    await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), appointmentId: appt!.id })
      .expect(404);
  });

  it('never returns another customer’s records', async () => {
    await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(otherToken))
      .send({ ...baseBody(), fullName: 'Somebody Else' })
      .expect(201);

    const mine = await request(app.getHttpServer())
      .get('/api/eye-records')
      .set(auth(token))
      .expect(200);

    expect(mine.body.length).toBeGreaterThan(0);
    expect(mine.body.some((r: { full_name: string }) => r.full_name === 'Somebody Else')).toBe(
      false,
    );
  });

  it('exposes no storefront route that edits a submitted record', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/eye-records/${created.body.id}`)
      .set(auth(token))
      .send({ status: 'reviewed' })
      .expect(404);
  });

  it('denies the admin list to a customer token', async () => {
    await request(app.getHttpServer()).get('/api/admin/eye-records').set(auth(token)).expect(403);
  });

  it('lets a permitted admin list and filter records', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/eye-records')
      .query({ status: 'submitted' })
      .set(auth(adminToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((r: { status: string }) => r.status === 'submitted')).toBe(true);
  });

  it('tracks reviewed_at/reviewed_by with status in both directions', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    expect(created.body.reviewed_at).toBeNull();

    const reviewed = await request(app.getHttpServer())
      .patch(`/api/admin/eye-records/${created.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'reviewed' })
      .expect(200);

    expect(reviewed.body.status).toBe('reviewed');
    expect(reviewed.body.reviewed_at).not.toBeNull();
    expect(reviewed.body.reviewed_by).not.toBeNull();

    // Moving back off `reviewed` must clear both stamps, not strand them.
    const archived = await request(app.getHttpServer())
      .patch(`/api/admin/eye-records/${created.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'archived' })
      .expect(200);

    expect(archived.body.status).toBe('archived');
    expect(archived.body.reviewed_at).toBeNull();
    expect(archived.body.reviewed_by).toBeNull();
  });

  it('writes an audit entry when a record changes status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/admin/eye-records/${created.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'reviewed' })
      .expect(200);

    const { data } = await db
      .from('audit_log')
      .select('action, resource_type, resource_id')
      .eq('resource_id', created.body.id)
      .eq('action', 'eye_record.status_changed')
      .maybeSingle();

    expect(data).not.toBeNull();
    expect(data!.resource_type).toBe('eye_record');
  });

  it('resolves the branch name for the admin queue, and null for a branchless record', async () => {
    // Branchless: no appointment behind it, so no branch owns it.
    const orphan = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    const { data: appt } = await db
      .from('appointments')
      .insert({
        customer_id: (
          await db.from('customers').select('id').eq('auth_user_id', userIds[0]).single()
        ).data!.id,
        branch_id: branchId,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + 11 * 864e5).toISOString(),
      })
      .select('id')
      .single();

    const linked = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), appointmentId: appt!.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/admin/eye-records')
      .set(auth(adminToken))
      .expect(200);

    const rows: { id: string; branch: { name: string } | null; branch_id: string | null }[] =
      res.body;
    const linkedRow = rows.find((r) => r.id === linked.body.id)!;
    const orphanRow = rows.find((r) => r.id === orphan.body.id)!;

    // The embed is normalised to an object, never PostgREST's array shape —
    // the admin screen reads `row.branch?.name` directly.
    expect(linkedRow.branch).not.toBeNull();
    expect(typeof linkedRow.branch!.name).toBe('string');
    expect(linkedRow.branch_id).toBe(branchId);

    expect(orphanRow.branch).toBeNull();
    expect(orphanRow.branch_id).toBeNull();
  });

  it('keeps the branch on the row a status change returns', async () => {
    const { data: appt } = await db
      .from('appointments')
      .insert({
        customer_id: (
          await db.from('customers').select('id').eq('auth_user_id', userIds[0]).single()
        ).data!.id,
        branch_id: branchId,
        type: 'eye_test',
        scheduled_at: new Date(Date.now() + 13 * 864e5).toISOString(),
      })
      .select('id')
      .single();

    const created = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send({ ...baseBody(), appointmentId: appt!.id })
      .expect(201);

    // The screen applies this response optimistically; a PATCH that dropped
    // `branch` would blank the column it is displaying.
    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/eye-records/${created.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'reviewed' })
      .expect(200);

    expect(updated.body.branch).not.toBeNull();
    expect(updated.body.branch.name).toEqual(expect.any(String));
  });

  it('rejects an unknown status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/eye-records')
      .set(auth(token))
      .send(baseBody())
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/admin/eye-records/${created.body.id}`)
      .set(auth(adminToken))
      .send({ status: 'nonsense' })
      .expect(400);
  });
});
