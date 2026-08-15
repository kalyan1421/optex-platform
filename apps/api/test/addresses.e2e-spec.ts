import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Saved addresses — `GET/POST /addresses`, `PATCH/DELETE /addresses/:id`,
 * `POST /addresses/:id/default`.
 *
 * The two guarantees that matter most: a customer can never read, update,
 * delete, or default another customer's address (404, not 403 or a partial
 * leak), and at most one address is ever marked default at a time — enforced
 * by the partial unique index in migration 0016, not just application logic.
 */
describe('Addresses (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  const addressIds: string[] = [];
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';

  /**
   * Capturing `id` (not just `email`) is what lets `afterAll` delete the
   * `auth.users` row directly — `customers.auth_user_id` cascades, so a
   * customer row deleted only by email lookup was leaving the auth user
   * itself behind on every run.
   */
  async function newAccount(): Promise<{ token: string; email: string; id: string }> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `addr-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email, id: data.user!.id };
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
  });

  afterAll(async () => {
    if (addressIds.length) {
      await db.from('customer_addresses').delete().in('id', addressIds);
    }
    // customer_addresses.customer_id cascades on delete (migration 0016), so
    // this alone is enough — no separate address cleanup is required before
    // it, unlike orders/prescriptions/appointments elsewhere in this suite.
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  const sampleAddress = (overrides: Record<string, unknown> = {}) => ({
    label: 'Home',
    name: 'Jane Wanjiku',
    phone: '+254712345678',
    address: 'Moi Avenue, Bruce House, 4th Floor',
    city: 'Nairobi',
    county: 'Nairobi',
    postal: '00100',
    ...overrides,
  });

  it('requires authentication for every route', async () => {
    await request(app.getHttpServer()).get('/api/addresses').expect(401);
    await request(app.getHttpServer()).post('/api/addresses').send(sampleAddress()).expect(401);
    await request(app.getHttpServer())
      .patch('/api/addresses/00000000-0000-0000-0000-000000000000')
      .send({ city: 'Mombasa' })
      .expect(401);
    await request(app.getHttpServer())
      .delete('/api/addresses/00000000-0000-0000-0000-000000000000')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/addresses/00000000-0000-0000-0000-000000000000/default')
      .expect(401);
  });

  it('rejects a missing required field', async () => {
    const { name, ...withoutName } = sampleAddress();
    await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(withoutName)
      .expect(400);
  });

  it('creates an address and lists it back', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress())
      .expect(201);

    expect(created.body.name).toBe('Jane Wanjiku');
    expect(created.body.label).toBe('Home');
    expect(created.body.is_default).toBe(false);
    addressIds.push(created.body.id);

    const list = await request(app.getHttpServer())
      .get('/api/addresses')
      .set(auth(token))
      .expect(200);
    expect(list.body.find((a: { id: string }) => a.id === created.body.id)).toBeDefined();
  });

  it('does not expose another customer’s addresses', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/addresses')
      .set(auth(otherToken))
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('creating a second address as default clears the first one’s default flag', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'Office', isDefault: true }))
      .expect(201);
    addressIds.push(first.body.id);
    expect(first.body.is_default).toBe(true);

    const second = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'Warehouse', isDefault: true }))
      .expect(201);
    addressIds.push(second.body.id);
    expect(second.body.is_default).toBe(true);

    // The database is the ground truth for "how many rows are actually
    // marked default" — asserting on it directly, not just trusting the two
    // HTTP responses, catches the case where the partial unique index
    // (migration 0016) didn't actually hold.
    const { data: rows } = await db
      .from('customer_addresses')
      .select('id, is_default')
      .in('id', [first.body.id, second.body.id]);
    const defaults = (rows ?? []).filter((r) => r.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.id);
  });

  it('updates one of the caller’s own addresses', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'To update' }))
      .expect(201);
    addressIds.push(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/addresses/${created.body.id}`)
      .set(auth(token))
      .send({ city: 'Kisumu', county: 'Kisumu' })
      .expect(200);

    expect(updated.body.city).toBe('Kisumu');
    expect(updated.body.county).toBe('Kisumu');
    // Untouched fields survive a partial update.
    expect(updated.body.name).toBe('Jane Wanjiku');
  });

  it('setting default via PATCH also clears any prior default', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'A', isDefault: true }))
      .expect(201);
    addressIds.push(a.body.id);

    const b = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'B', isDefault: false }))
      .expect(201);
    addressIds.push(b.body.id);

    const patched = await request(app.getHttpServer())
      .patch(`/api/addresses/${b.body.id}`)
      .set(auth(token))
      .send({ isDefault: true })
      .expect(200);
    expect(patched.body.is_default).toBe(true);

    const { data: rows } = await db
      .from('customer_addresses')
      .select('id, is_default')
      .in('id', [a.body.id, b.body.id]);
    const defaults = (rows ?? []).filter((r) => r.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b.body.id);
  });

  it('the dedicated default endpoint marks one address default and clears the rest', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'C', isDefault: true }))
      .expect(201);
    addressIds.push(a.body.id);

    const b = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'D' }))
      .expect(201);
    addressIds.push(b.body.id);

    const result = await request(app.getHttpServer())
      .post(`/api/addresses/${b.body.id}/default`)
      .set(auth(token))
      .expect(201);
    expect(result.body.is_default).toBe(true);
    expect(result.body.id).toBe(b.body.id);

    const { data: rows } = await db
      .from('customer_addresses')
      .select('id, is_default')
      .in('id', [a.body.id, b.body.id]);
    const defaults = (rows ?? []).filter((r) => r.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b.body.id);
  });

  it('deletes one of the caller’s own addresses', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'To delete' }))
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/addresses/${created.body.id}`)
      .set(auth(token))
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/addresses')
      .set(auth(token))
      .expect(200);
    expect(list.body.find((a: { id: string }) => a.id === created.body.id)).toBeUndefined();
  });

  it("does not expose or allow acting on another customer's address", async () => {
    const created = await request(app.getHttpServer())
      .post('/api/addresses')
      .set(auth(token))
      .send(sampleAddress({ label: 'Owned by primary' }))
      .expect(201);
    addressIds.push(created.body.id);

    // Same 404 whether the row is missing or just not owned by the caller —
    // distinguishing them would confirm the address's existence to a
    // stranger, the same discipline every other customer-scoped module here
    // follows.
    await request(app.getHttpServer())
      .patch(`/api/addresses/${created.body.id}`)
      .set(auth(otherToken))
      .send({ city: 'Eldoret' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/addresses/${created.body.id}`)
      .set(auth(otherToken))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/addresses/${created.body.id}/default`)
      .set(auth(otherToken))
      .expect(404);
  });

  it('404s a well-formed but nonexistent address id', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .patch(`/api/addresses/${missing}`)
      .set(auth(token))
      .send({ city: 'Nakuru' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/addresses/${missing}`)
      .set(auth(token))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/addresses/${missing}/default`)
      .set(auth(token))
      .expect(404);
  });
});
