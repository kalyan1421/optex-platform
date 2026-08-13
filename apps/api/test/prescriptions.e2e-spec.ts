import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Prescriptions — HEALTH data, stored in a private bucket, exposed only via
 * 60-second signed URLs. Zero test coverage existed for any of it before this
 * file: not the ownership isolation the service's own comments call out as
 * the point ("never exposes another customer's prescription"), not the
 * upload validation, not the admin path.
 */
describe('Prescriptions (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  const emails: string[] = [];
  const prescriptionIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const PDF_BYTES = Buffer.from('%PDF-1.4 e2e fixture, not a real PDF');

  async function newAccount(): Promise<{ token: string; email: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `rx-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    emails.push(email);
    return { token: data.session!.access_token, email };
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
    for (const id of prescriptionIds) {
      const { data: row } = await db
        .from('prescriptions')
        .select('file_url')
        .eq('id', id)
        .maybeSingle();
      if (row?.file_url) {
        await db.storage.from('prescriptions').remove([row.file_url]);
      }
      await db.from('prescriptions').delete().eq('id', id);
    }
    for (const email of emails) {
      const { data: c } = await db.from('customers').select('id').eq('email', email).maybeSingle();
      if (c) await db.from('customers').delete().eq('id', c.id);
    }
    await app.close();
  });

  it('requires authentication for every customer route', async () => {
    await request(app.getHttpServer()).get('/api/prescriptions').expect(401);
    await request(app.getHttpServer())
      .get('/api/prescriptions/00000000-0000-0000-0000-000000000000/download')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/prescriptions/upload')
      .attach('file', PDF_BYTES, 'rx.pdf')
      .expect(401);
  });

  it('rejects an unsupported file type', async () => {
    await request(app.getHttpServer())
      .post('/api/prescriptions/upload')
      .set(auth(token))
      .attach('file', Buffer.from('not a real prescription'), 'rx.txt')
      .expect(400);
  });

  it('rejects a file over the 10MB ceiling', async () => {
    // `FileInterceptor('file')` has no size limit configured — the cap is
    // enforced inside `PrescriptionsService.upload()`, so this is a 400 from
    // application logic, not a body-parser rejection.
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    await request(app.getHttpServer())
      .post('/api/prescriptions/upload')
      .set(auth(token))
      .attach('file', oversized, 'rx.pdf')
      .expect(400);
  }, 15000);

  it('uploads a prescription and stores it under the caller alone', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/prescriptions/upload')
      .set(auth(token))
      .field('sphere_od', '-1.25')
      .field('sphere_os', '-1.5')
      .field('pd', '62')
      .attach('file', PDF_BYTES, 'rx.pdf')
      .expect(201);

    expect(res.body.status).toBe('pending');
    expect(Number(res.body.sphere_od)).toBe(-1.25);
    prescriptionIds.push(res.body.id);

    const { data: row } = await db
      .from('prescriptions')
      .select('file_url')
      .eq('id', res.body.id)
      .single();
    // Storage isolation: the object path is namespaced by customer id, not
    // guessable from the prescription id alone.
    expect(row!.file_url).toMatch(/^[0-9a-f-]{36}\//i);
  });

  it('lists only the caller’s own prescriptions', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/prescriptions')
      .set(auth(token))
      .expect(200);
    expect(mine.body.length).toBeGreaterThanOrEqual(1);

    const theirs = await request(app.getHttpServer())
      .get('/api/prescriptions')
      .set(auth(otherToken))
      .expect(200);
    expect(theirs.body).toHaveLength(0);
  });

  it('signs a download URL for the caller’s own prescription', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/prescriptions/${prescriptionIds[0]}/download`)
      .set(auth(token))
      .expect(200);

    expect(res.body.expiresIn).toBe(60);
    expect(res.body.url).toMatch(/^https?:\/\//);
  });

  it('404s a download attempt on another customer’s prescription — no info leak', async () => {
    await request(app.getHttpServer())
      .get(`/api/prescriptions/${prescriptionIds[0]}/download`)
      .set(auth(otherToken))
      .expect(404);
  });

  describe('admin', () => {
    it('refuses a non-admin on every admin route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/prescriptions')
        .set(auth(otherToken))
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/admin/prescriptions/${prescriptionIds[0]}/download`)
        .set(auth(otherToken))
        .expect(403);
    });

    it('can list and download any customer’s prescription', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/admin/prescriptions')
        .set(auth(adminToken))
        .expect(200);
      expect(list.body.find((p: { id: string }) => p.id === prescriptionIds[0])).toBeDefined();

      const dl = await request(app.getHttpServer())
        .get(`/api/admin/prescriptions/${prescriptionIds[0]}/download`)
        .set(auth(adminToken))
        .expect(200);
      expect(dl.body.url).toMatch(/^https?:\/\//);
    });

    it('marking processed stamps processed_at; marking pending clears it', async () => {
      const processed = await request(app.getHttpServer())
        .patch(`/api/admin/prescriptions/${prescriptionIds[0]}`)
        .set(auth(adminToken))
        .send({ status: 'processed' })
        .expect(200);
      expect(processed.body.status).toBe('processed');
      expect(processed.body.processed_at).toBeTruthy();

      const backToPending = await request(app.getHttpServer())
        .patch(`/api/admin/prescriptions/${prescriptionIds[0]}`)
        .set(auth(adminToken))
        .send({ status: 'pending' })
        .expect(200);
      expect(backToPending.body.status).toBe('pending');
      expect(backToPending.body.processed_at).toBeNull();
    });
  });
});
