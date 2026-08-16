import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Password reset via the API proxy — audit finding F-22.
 *
 * BEFORE: `apps/web/app/forgot-password/page.jsx` and `reset-password/page.jsx`
 * were the last customer-facing auth flow still calling Supabase directly from
 * the browser (`db.auth.resetPasswordForEmail`, `db.auth.updateUser`). Every
 * other auth mutation — login, signup, refresh, logout — already went through
 * `/api/auth/*`; reset traffic was invisible to the API's logging, throttling,
 * and request-id correlation, and had no server-side test.
 *
 * These assertions cover the two things that actually matter for a password
 * reset endpoint: that it never becomes an account-enumeration oracle, and
 * that the full round trip — request, set, old password dead, new password
 * live — genuinely works end to end against a real Supabase Auth instance.
 */
describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  const userIds: string[] = [];

  const PASSWORD = 'OriginalPassword123!';

  async function newAccount(): Promise<{ email: string; token: string; userId: string }> {
    const email = `reset-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(201);
    const userId = res.body.user.id as string;
    userIds.push(userId);
    return { email, token: res.body.session.accessToken as string, userId };
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
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await app.close();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('accepts a registered email and gives no indication either way', async () => {
      const { email } = await newAccount();

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it('gives the IDENTICAL response for an email that was never registered', async () => {
      // The account-enumeration check. If these two responses ever diverge —
      // in status, body, or timing an attacker could plausibly use — this
      // endpoint has become a way to test whether an email address is a
      // customer, which the audit called out specifically.
      const registered = await newAccount();

      const forRegistered = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: registered.email });
      const forUnregistered = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: `never-signed-up-${Date.now()}@optex-test.local` });

      expect(forUnregistered.status).toBe(forRegistered.status);
      expect(forUnregistered.body).toEqual(forRegistered.body);
    });

    it('rejects a malformed email before it ever reaches GoTrue', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('requires a bearer token — there is no email or user id in the body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ password: 'SomeNewPassword123!' });

      expect(res.status).toBe(401);
    });

    it('refuses a bogus token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ password: 'SomeNewPassword123!' });

      expect(res.status).toBe(401);
    });

    it('rejects a password under 6 characters for a validly authenticated caller', async () => {
      const { token } = await newAccount();

      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'abc' });

      expect(res.status).toBe(400);
    });

    it('sets a new password: the old one stops working, the new one logs in', async () => {
      // THE REGRESSION THIS FILE EXISTS FOR: the full round trip against a
      // real Supabase Auth instance, not a mock — signup, reset via the token
      // a session already carries, then prove BOTH directions actually took
      // effect rather than just returning 204.
      const { email, token } = await newAccount();
      const newPassword = 'BrandNewPassword456!';

      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: newPassword })
        .expect(204);

      const oldLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: newPassword });
      expect(newLogin.status).toBe(201);
      expect(newLogin.body.session.accessToken).toBeTruthy();
    });
  });
});
