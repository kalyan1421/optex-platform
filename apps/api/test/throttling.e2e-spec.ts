import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';

/**
 * Rate limiting — audit findings F-01 and F-03.
 *
 * BEFORE: the guard keyed every request on `req.ip`, and `trust proxy` was
 * never set. All browser traffic arrives through the Next.js `/api/*` rewrite,
 * so every customer in the country presented the proxy's address and drew from
 * ONE 100/min bucket. Measured: 115 sequential requests from a single client
 * returned 98×200 / 17×429, and varying `X-Forwarded-For` changed nothing.
 * `/api/health` sat in the same bucket, so saturation made the liveness probe
 * fail and the orchestrator restart healthy containers at peak.
 *
 * AFTER: `UserAwareThrottlerGuard` keys signed-in callers on the VERIFIED
 * `sub` of their token so they never share a bucket, `main.ts` trusts one
 * forwarding hop so anonymous callers resolve to their real address, and
 * health skips the limiter entirely.
 *
 * The tracker keyed on a hash of the raw token until it was found to be
 * trivially bypassable: any string minted a fresh bucket, so rotating the
 * `Authorization` header defeated rate limiting entirely, with no credentials.
 * Measured against the running API: 310 requests with one junk token returned
 * 429, while rotating the junk token returned 60/60 not throttled. It now
 * verifies the HS256 signature and keys on `sub`, so junk and forged tokens
 * fall back to the anonymous IP bucket. The last two tests below are the
 * regression guards for that.
 *
 * These assertions are about ISOLATION — that two distinct callers do not
 * consume each other's quota — not about the exact ceiling, which is
 * deployment-tunable.
 */
describe('Rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  /** Comfortably above the per-route auth override, below the global bucket. */
  const BURST = 12;

  const PASSWORD = 'TestPassword123!';
  const anon = () =>
    createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
      auth: { persistSession: false },
    });

  /**
   * A REAL signed token. The tracker verifies the signature now, so a made-up
   * string no longer reaches the per-user bucket — these tests would be
   * measuring the shared IP bucket if they kept using junk.
   */
  async function newUser(): Promise<{ email: string; token: string }> {
    const email = `throttle-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon().auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    return { email, token: data.session!.access_token };
  }

  async function signInAgain(email: string): Promise<string> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw error;
    return data.session!.access_token;
  }

  beforeAll(async () => {
    // Keep the credential override tight so this suite can actually reach it —
    // `setup-env.ts` raises it for every other suite.
    process.env.AUTH_RATE_LIMIT = '5';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    // Mirrors main.ts — without this the tracker cannot see a forwarded address.
    app.set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    delete process.env.AUTH_RATE_LIMIT;
    await app.close();
  });

  it('never rate-limits the liveness probe (F-03)', async () => {
    // The regression that would restart healthy containers under load.
    //
    // The ABSENCE of the quota headers is the real proof: they are emitted on
    // every throttled route, so their absence means `@SkipThrottle` applied and
    // no counter exists for this route at all. A large burst adds nothing to
    // that — and volume here is actively harmful: an earlier version fired 400
    // requests, exhausted the process's sockets, and made unrelated suites fail
    // with "socket hang up". All 14 suites share one `--runInBand` process, so
    // every request this file makes is a socket the others cannot use. 15 is
    // more than a probe ever sends in a burst and costs the suite nothing.
    const statuses: number[] = [];
    let headers: Record<string, unknown> = {};
    for (let i = 0; i < 15; i++) {
      const res = await request(app.getHttpServer()).get('/api/health');
      statuses.push(res.status);
      headers = res.headers;
    }

    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(headers['x-ratelimit-limit']).toBeUndefined();
    expect(headers['x-ratelimit-remaining']).toBeUndefined();
  }, 30_000);

  it('gives distinct users independent quotas (F-01)', async () => {
    // Real signed tokens, not junk: the tracker verifies the signature before
    // it will hand out a per-user bucket, so junk here would measure the shared
    // anonymous bucket and prove nothing about isolation.
    //
    // Asserted against a FRESH key's absolute remaining rather than by
    // comparing two callers' counts. The throttler store is in-memory and
    // shared across every suite in this `--runInBand` process, so any
    // comparison that assumes an untouched bucket breaks depending on which
    // suites ran first — which is precisely how this test failed the first time.
    const burn = async (token: string, times: number) => {
      let last = '';
      for (let i = 0; i < times; i++) {
        const res = await request(app.getHttpServer())
          .get('/api/cart')
          .set('Authorization', `Bearer ${token}`);
        last = res.headers['x-ratelimit-remaining'];
      }
      return Number(last);
    };

    // Read the ceiling from the SAME route we then exercise. The public
    // catalogue routes carry their own much higher limit (see
    // products.controller.ts), so taking the number from /api/products and
    // asserting it against /api/cart compares two different buckets — which is
    // exactly how this test broke when those ceilings were introduced.
    const userA = await newUser();
    const limit = Number(
      (
        await request(app.getHttpServer())
          .get('/api/cart')
          .set('Authorization', `Bearer ${userA.token}`)
      ).headers['x-ratelimit-limit'],
    );

    await burn(userA.token, BURST);
    // B has never been seen, so its very first request must leave a full
    // quota minus one — regardless of how much A just spent, or anyone else.
    const userB = await newUser();
    const remainingB = await burn(userB.token, 1);

    expect(remainingB).toBe(limit - 1);
  }, 30_000);

  it('does not hand a user a fresh quota for re-authenticating', async () => {
    // The bucket is the token's subject, not the token itself. Signing in again
    // is a new token for the same person and must continue the same ceiling —
    // otherwise the limit is only ever as strong as the login rate limit.
    const user = await newUser();
    const spend = async (token: string) =>
      Number(
        (
          await request(app.getHttpServer())
            .get('/api/cart')
            .set('Authorization', `Bearer ${token}`)
        ).headers['x-ratelimit-remaining'],
      );

    await spend(user.token);
    const beforeReauth = await spend(user.token);

    const secondToken = await signInAgain(user.email);
    expect(secondToken).not.toBe(user.token);

    const afterReauth = await spend(secondToken);
    expect(afterReauth).toBe(beforeReauth - 1);
  }, 30_000);

  it('does not let a rotating Authorization header bypass the limit', async () => {
    // THE REGRESSION GUARD. When the tracker hashed the raw token, every
    // distinct string was a new bucket, so this loop ran forever unthrottled —
    // rate limiting was defeated by anyone willing to send a random header, no
    // credentials required. Junk now fails signature verification and falls
    // back to the shared anonymous bucket, so the run must hit 429.
    let throttled = 0;
    for (let i = 0; i < 400; i++) {
      const res = await request(app.getHttpServer())
        .get('/api/cart')
        .set('X-Forwarded-For', '203.0.113.77')
        .set('Authorization', `Bearer rotating-junk-${i}-${Math.random()}`);
      if (res.status === 429) {
        throttled += 1;
        if (throttled > 2) break;
      }
    }
    expect(throttled).toBeGreaterThan(0);
  }, 60_000);

  it('separates anonymous callers by forwarded address, not by proxy (F-01)', async () => {
    const hit = (ip: string) =>
      request(app.getHttpServer()).get('/api/products').set('X-Forwarded-For', ip);

    const limit = Number((await hit('203.0.113.1')).headers['x-ratelimit-limit']);

    // Spend several requests as one shopper…
    const busy = `203.0.113.${(Date.now() % 200) + 10}`;
    for (let i = 0; i < 5; i++) await hit(busy);

    // …then arrive as a different one behind the same proxy. A full quota minus
    // one proves the first shopper's spending did not touch this bucket.
    const fresh = `198.51.100.${(Date.now() % 200) + 10}`;
    const res = await hit(fresh);

    expect(Number(res.headers['x-ratelimit-remaining'])).toBe(limit - 1);
  });

  it('applies a tight ceiling to the credential endpoints', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.99')
        .send({ email: 'nobody@optex-test.local', password: 'WrongPassword123!' });

    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await attempt()).status);

    // Password guessing has to stop well before 12 tries.
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(5);
  });

  it('does not let the credential ceiling leak onto the rest of the API', async () => {
    // The first attempt at this fix declared `auth` as a second global bucket,
    // which capped every route at 10/min and turned four e2e suites red. The
    // override is per-route; this proves it stayed there.
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('X-Forwarded-For', '203.0.113.99');

    expect(res.status).toBe(200);
    expect(Number(res.headers['x-ratelimit-limit'])).toBeGreaterThan(100);
  });
});
