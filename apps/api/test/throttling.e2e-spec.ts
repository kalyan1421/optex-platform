import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
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
 * AFTER: `UserAwareThrottlerGuard` keys signed-in callers on their bearer token
 * so they never share a bucket, `main.ts` trusts one forwarding hop so
 * anonymous callers resolve to their real address, and health skips the
 * limiter entirely.
 *
 * These assertions are about ISOLATION — that two distinct callers do not
 * consume each other's quota — not about the exact ceiling, which is
 * deployment-tunable.
 */
describe('Rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  /** Comfortably above the per-route auth override, below the global bucket. */
  const BURST = 30;

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
    // The regression that would restart healthy containers under load: far more
    // requests than any bucket allows, all of which must succeed.
    //
    // Sequential, not `Promise.all`. Firing hundreds at once resets the
    // connection on the ephemeral test server and fails for reasons that have
    // nothing to do with throttling — a flaky test dressed up as a real one.
    const statuses: number[] = [];
    let headers: Record<string, unknown> = {};
    for (let i = 0; i < 400; i++) {
      const res = await request(app.getHttpServer()).get('/api/health');
      statuses.push(res.status);
      headers = res.headers;
    }

    expect(statuses.every((s) => s === 200)).toBe(true);
    // No quota headers at all — the guard was skipped, not merely satisfied.
    expect(headers['x-ratelimit-limit']).toBeUndefined();
  }, 30_000);

  it('gives distinct bearer tokens independent quotas (F-01)', async () => {
    // The tokens are junk, so every request 401s — which is fine and is the
    // point: the throttler runs BEFORE authentication, so a 401 still consumes
    // quota. What matters is whose quota it consumes.
    const burn = async (token: string) => {
      for (let i = 0; i < BURST; i++) {
        await request(app.getHttpServer())
          .get('/api/cart')
          .set('Authorization', `Bearer token-${token}`);
      }
      const res = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer token-${token}`);
      return res.headers['x-ratelimit-remaining'];
    };

    const remainingA = Number(await burn('customer-a'));
    const remainingB = Number(await burn('customer-b'));

    // If both keyed on the shared IP, B would start where A finished and its
    // remaining count would be roughly BURST lower. Keyed per token they match.
    expect(remainingB).toBe(remainingA);
  }, 30_000);

  it('separates anonymous callers by forwarded address, not by proxy (F-01)', async () => {
    const remainingFor = async (ip: string) => {
      let last = '';
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Forwarded-For', ip);
        last = res.headers['x-ratelimit-remaining'];
      }
      return Number(last);
    };

    const first = await remainingFor('203.0.113.10');
    const second = await remainingFor('203.0.113.11');

    // Two shoppers behind the same proxy must not drain one another's quota.
    expect(second).toBe(first);
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
