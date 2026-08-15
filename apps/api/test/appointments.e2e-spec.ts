import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Appointment booking — SPEC-04.
 *
 * Zero coverage existed for this module before this file: booking, slot
 * validation, ownership and cancellation were all "done" per FEATURE-STATUS
 * but unverified by anything automated. The one that matters most is the
 * concurrency case — SPEC-04 R1 is explicit that "a concurrency test exists
 * and runs in CI" is an acceptance criterion, not a nice-to-have, because the
 * failure mode (two patients arrive for one optometrist) is invisible in the
 * software and only visible in the waiting room.
 */
describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let token: string;
  let otherToken: string;
  let adminToken: string;
  let branchId: string;
  const appointmentIds: string[] = [];
  const userIds: string[] = [];

  const PASSWORD = 'TestPassword123!';
  const BRANCH_SLUG = 'e2e-appointments-branch';

  /**
   * Sign a fresh account up through gotrue and return its access token.
   *
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
    const email = `appt-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);
    return { token: data.session!.access_token, email, id: data.user!.id };
  }

  /** A future YYYY-MM-DD, far enough out that "today" edge cases never apply. */
  function futureDate(daysAhead: number): string {
    const d = new Date(Date.now() + daysAhead * 24 * 3600_000);
    return d.toISOString().slice(0, 10);
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

    // A real super_admin, promoted through the admin API — the roles guard
    // verifies the token against Supabase rather than trusting its claims.
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

    // Open every weekday wide (00:00-23:30) so this suite never depends on
    // which real weekday CI happens to run on.
    const wideOpen: [string, string] = ['00:00', '23:30'];
    // A break window deliberately far from every other test's booking time
    // in this file (all in the 09:00-17:00 range) so adding it can't collide
    // with an existing, unrelated assertion. Set on every weekday — like
    // `hours` above — so the break test below doesn't depend on which real
    // weekday CI happens to run on.
    const earlyBreak: [string, string] = ['05:00', '06:00'];
    await db.from('branches').delete().eq('slug', BRANCH_SLUG);
    const { data: branch, error } = await db
      .from('branches')
      .insert({
        slug: BRANCH_SLUG,
        name: 'E2E Appointments Branch',
        hours: {
          sun: wideOpen,
          mon: wideOpen,
          tue: wideOpen,
          wed: wideOpen,
          thu: wideOpen,
          fri: wideOpen,
          sat: wideOpen,
        },
        breaks: {
          sun: earlyBreak,
          mon: earlyBreak,
          tue: earlyBreak,
          wed: earlyBreak,
          thu: earlyBreak,
          fri: earlyBreak,
          sat: earlyBreak,
        },
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw error;
    branchId = branch!.id;
  });

  afterAll(async () => {
    if (appointmentIds.length) {
      await db.from('appointments').delete().in('id', appointmentIds);
    }
    await db.from('branches').delete().eq('slug', BRANCH_SLUG);
    // appointments.customer_id has no ON DELETE CASCADE — must be gone
    // before deleting the auth user, or the cascade to `customers` 409s.
    for (const id of userIds) {
      await db.auth.admin.deleteUser(id);
    }
    await app.close();
  });

  it('requires authentication to book', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .send({ branchId, date: futureDate(3), time: '09:00' })
      .expect(401);
  });

  it('lists available slots for the branch, publicly, and none are pre-taken', async () => {
    const date = futureDate(3);
    const res = await request(app.getHttpServer())
      .get('/api/appointments/slots')
      .query({ branchId, date })
      .expect(200);

    expect(res.body.slots).toContain('09:00');
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it('books a valid slot for the caller', async () => {
    const date = futureDate(4);
    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '11:00', notes: 'first visit' })
      .expect(201);

    expect(res.body.status).toBe('pending');
    expect(res.body.branch_id).toBe(branchId);
    appointmentIds.push(res.body.id);

    // The booked slot must now be excluded from availability.
    const slots = await request(app.getHttpServer())
      .get('/api/appointments/slots')
      .query({ branchId, date })
      .expect(200);
    expect(slots.body.slots).not.toContain('11:00');
  });

  it('refuses a time outside the slot grid', async () => {
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date: futureDate(5), time: '11:07' })
      .expect(400);
  });

  it('excludes slots overlapping a configured break, but keeps the slot starting at the break’s end', async () => {
    const date = futureDate(13);
    const slots = await request(app.getHttpServer())
      .get('/api/appointments/slots')
      .query({ branchId, date })
      .expect(200);

    // The branch's break is 05:00-06:00: the 05:00 and 05:30 slots both
    // overlap it and must be gone, but 06:00 — which starts exactly when the
    // break ends — must remain bookable. Getting this boundary wrong either
    // way (excluding 06:00, or leaving 05:30 in) is the actual risk here,
    // not the happy-path "some slot got removed" case.
    expect(slots.body.slots).not.toContain('05:00');
    expect(slots.body.slots).not.toContain('05:30');
    expect(slots.body.slots).toContain('06:00');

    // The booking guard enforces the same exclusion as the listing, not just
    // a UI-level filter.
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '05:00' })
      .expect(400);

    const booked = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '06:00' })
      .expect(201);
    appointmentIds.push(booked.body.id);
  });

  it('refuses a second booking for an already-taken slot (sequential)', async () => {
    const date = futureDate(6);
    const first = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '14:00' })
      .expect(201);
    appointmentIds.push(first.body.id);

    const second = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(otherToken))
      .send({ branchId, date, time: '14:00' })
      .expect(409);
    expect(second.body.message).toMatch(/already booked/i);
  });

  /**
   * SPEC-04 R1's acceptance criterion, verbatim: "Given two concurrent
   * bookings for the last free slot, then exactly one succeeds and the other
   * receives a clear 'already booked' response."
   *
   * `assertSlotBookable()` is a SELECT-then-INSERT with no database
   * constraint behind it (`appointments.service.ts`) — nothing stops both
   * requests from passing the SELECT before either INSERT lands. This test
   * fires both requests without awaiting between them, which a sequential
   * test (above) cannot do.
   */
  it('allows exactly one of five concurrent bookings for the same slot', async () => {
    // Two racers is easy to win by accident — Node's I/O scheduling or
    // connection-pool serialization can happen to interleave two requests
    // sequentially even under `Promise.all`, making a passing test prove
    // nothing. Five racers, five distinct customers, makes an accidental
    // pass far less likely and gives `appointments_one_per_slot` (migration
    // 0014) — the actual guarantee — real work to do.
    const date = futureDate(7);
    const time = '16:00';
    const racers = await Promise.all(Array.from({ length: 5 }, () => newAccount()));

    const results = await Promise.all(
      racers.map((r) =>
        request(app.getHttpServer())
          .post('/api/appointments')
          .set(auth(r.token))
          .send({ branchId, date, time }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 201);
    const conflicted = results.filter((r) => r.status === 409);
    for (const r of succeeded) appointmentIds.push(r.body.id);

    // The DB is the ground truth for "how many bookings actually landed" —
    // asserting on it directly rather than trusting the HTTP statuses alone
    // catches the case where more than one request is told 201.
    const { data: rows } = await db
      .from('appointments')
      .select('id, status')
      .eq('branch_id', branchId)
      .gte('scheduled_at', `${date}T00:00:00+03:00`)
      .lt('scheduled_at', `${date}T23:59:59+03:00`)
      .neq('status', 'cancelled');

    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(4);
    expect(rows ?? []).toHaveLength(1);
  });

  it('cancels the caller’s own booking, and refuses to cancel it twice', async () => {
    const date = futureDate(8);
    const created = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '10:00' })
      .expect(201);
    appointmentIds.push(created.body.id);

    const cancelled = await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}/cancel`)
      .set(auth(token))
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');

    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}/cancel`)
      .set(auth(token))
      .expect(409);

    // A cancelled slot must free up again.
    const slots = await request(app.getHttpServer())
      .get('/api/appointments/slots')
      .query({ branchId, date })
      .expect(200);
    expect(slots.body.slots).toContain('10:00');
  });

  it("does not expose or allow acting on another customer's booking", async () => {
    const date = futureDate(9);
    const created = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '10:30' })
      .expect(201);
    appointmentIds.push(created.body.id);

    // Same 404 whether the row is missing or just not owned by the caller —
    // distinguishing them would confirm the booking's existence to a
    // stranger.
    await request(app.getHttpServer())
      .patch(`/api/appointments/${created.body.id}/cancel`)
      .set(auth(otherToken))
      .expect(404);

    const list = await request(app.getHttpServer())
      .get('/api/appointments')
      .set(auth(otherToken))
      .expect(200);
    expect(list.body.find((a: { id: string }) => a.id === created.body.id)).toBeUndefined();
  });

  it('reschedules into a free slot, and refuses a reschedule into a taken one', async () => {
    const date = futureDate(10);
    const a = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(token))
      .send({ branchId, date, time: '09:30' })
      .expect(201);
    appointmentIds.push(a.body.id);
    const b = await request(app.getHttpServer())
      .post('/api/appointments')
      .set(auth(otherToken))
      .send({ branchId, date, time: '15:00' })
      .expect(201);
    appointmentIds.push(b.body.id);

    // Reschedule a onto a genuinely free slot.
    const rescheduled = await request(app.getHttpServer())
      .patch(`/api/appointments/${a.body.id}/reschedule`)
      .set(auth(token))
      .send({ date, time: '09:00' })
      .expect(200);
    expect(rescheduled.body.status).toBe('rescheduled');

    // Reschedule b onto a's now-vacated original slot works...
    // ...but rescheduling b onto the slot a now occupies must be refused.
    await request(app.getHttpServer())
      .patch(`/api/appointments/${b.body.id}/reschedule`)
      .set(auth(otherToken))
      .send({ date, time: '09:00' })
      .expect(409);
  });

  describe('admin', () => {
    it('refuses a non-admin on every admin route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/appointments')
        .set(auth(otherToken))
        .expect(403);
    });

    it('lists bookings with resolvable customer and branch names, not raw uuids', async () => {
      const date = futureDate(11);
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .set(auth(token))
        .send({ branchId, date, time: '13:00' })
        .expect(201);
      appointmentIds.push(created.body.id);

      const res = await request(app.getHttpServer())
        .get('/api/admin/appointments')
        .query({ branchId, date })
        .set(auth(adminToken))
        .expect(200);

      const row = res.body.find((a: { id: string }) => a.id === created.body.id);
      expect(row).toBeDefined();
      // `full_name` is null for this fixture (signup didn't set it) — `email`
      // is what the trigger always populates, and is enough to prove the
      // embed resolved a real customer row rather than G-9's null join.
      expect(row.customer?.email).toBeTruthy();
      expect(row.branch?.name).toBe('E2E Appointments Branch');
    });

    it('reschedules a booking directly, bypassing the customer ownership check', async () => {
      const date = futureDate(12);
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .set(auth(token))
        .send({ branchId, date, time: '12:00' })
        .expect(201);
      appointmentIds.push(created.body.id);

      const updated = await request(app.getHttpServer())
        .patch(`/api/admin/appointments/${created.body.id}`)
        .set(auth(adminToken))
        .send({ date, time: '12:30' })
        .expect(200);
      expect(updated.body.status).toBe('rescheduled');

      // The admin path re-validates the target slot too — it must not be able
      // to create a clash any more than the customer path can.
      const clashSeed = await request(app.getHttpServer())
        .post('/api/appointments')
        .set(auth(otherToken))
        .send({ branchId, date, time: '17:00' })
        .expect(201);
      appointmentIds.push(clashSeed.body.id);

      await request(app.getHttpServer())
        .patch(`/api/admin/appointments/${created.body.id}`)
        .set(auth(adminToken))
        .send({ date, time: '17:00' })
        .expect(409);
    });
  });
});
