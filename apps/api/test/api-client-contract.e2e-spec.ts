import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createApiClient } from '@optex/api-client';
import { AppModule } from '../src/app.module';

/**
 * Contract tests for `@optex/api-client`.
 *
 * That package calls itself "the API contract" in its own description, three
 * apps route every write through it, and nothing verified it against the API
 * it claims to describe. A renamed controller route or a changed path
 * parameter is a compile-clean change on both sides — the client keeps
 * type-checking against its own hand-written interfaces, the API keeps
 * type-checking against its own DTOs, and the break only appears at runtime in
 * a browser.
 *
 * The approach: give the client a `fetch` that records instead of sending, so
 * every method's real URL construction runs, then check each recorded route
 * against the API's own OpenAPI document. Nothing here is a hand-maintained
 * list of routes — that would drift in exactly the way this is meant to catch.
 *
 * Two failures are possible and both matter:
 *   1. A client method issues a request the API does not expose (drift).
 *   2. A client method could not be invoked at all (the probe below could not
 *      find arguments for it), which means it is silently uncovered.
 */
describe('@optex/api-client contract (e2e)', () => {
  let app: INestApplication;
  /** `METHOD /path` for every route the API actually exposes. */
  let apiRoutes: { method: string; regex: RegExp; template: string }[] = [];

  /** Recorded by the fake fetch: what the client tried to send. */
  const sent: { method: string; url: string }[] = [];

  /**
   * The generic escape hatch, not a route — it takes whatever path the caller
   * gives it, so there is no contract to check.
   */
  const NOT_A_ROUTE = new Set(['request']);

  /**
   * Argument shapes to try, in order, until one produces a request. Most
   * methods take an id, an input object, or an optional query; probing beats a
   * hand-written table because a newly added method is covered automatically.
   */
  const CANDIDATES: unknown[][] = [
    [],
    ['probe-id'],
    [{}],
    ['probe-id', {}],
    ['probe-id', 'probe-id'],
    [{}, {}],
    ['probe-id', {}, {}],
  ];

  /** Methods whose first argument must be a real Blob (multipart uploads). */
  const OVERRIDES: Record<string, unknown[]> = {
    'prescriptions.upload': [new Blob(['x']), {}],
    'admin.products.uploadImage': ['probe-id', new Blob(['x'])],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Same prefix and pipe as main.ts — the OpenAPI paths must be the ones the
    // deployed app serves, not a differently-configured test app.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('OPTEX API').setVersion('0.1.0').build(),
    );

    apiRoutes = Object.entries(doc.paths).flatMap(([template, ops]) =>
      Object.keys(ops as object)
        .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
        .map((m) => ({
          method: m.toUpperCase(),
          template,
          // `/api/products/{id}/images` → matches `/api/products/anything/images`
          regex: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
        })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /** Every callable leaf on the client, as a dotted path. */
  function walk(node: unknown, prefix = ''): string[] {
    const found: string[] = [];
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'function') found.push(path);
      else if (value && typeof value === 'object') found.push(...walk(value, path));
    }
    return found;
  }

  function resolve(client: unknown, path: string): (...args: unknown[]) => unknown {
    return path
      .split('.')
      .reduce<
        Record<string, unknown>
      >((o, k) => o[k] as Record<string, unknown>, client as Record<string, unknown>) as unknown as (
      ...args: unknown[]
    ) => unknown;
  }

  it('issues only requests the API actually exposes', async () => {
    const client = createApiClient({
      baseUrl: 'http://contract.probe',
      getAccessToken: async () => 'probe-token',
      // Records and returns an empty success, so the client's own response
      // handling runs without a server.
      fetch: (async (url: string, init: { method?: string }) => {
        sent.push({ method: (init?.method ?? 'GET').toUpperCase(), url: String(url) });
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as unknown as typeof fetch,
    });

    const methods = walk(client).filter((m) => !NOT_A_ROUTE.has(m));
    expect(methods.length).toBeGreaterThan(100);

    const uncovered: string[] = [];
    const mismatched: string[] = [];

    for (const name of methods) {
      const fn = resolve(client, name);
      const attempts = OVERRIDES[name] ? [OVERRIDES[name]] : CANDIDATES;

      let recorded: { method: string; url: string } | undefined;
      for (const args of attempts) {
        sent.length = 0;
        try {
          await fn(...args);
        } catch {
          // A method may reject on a probe argument it cannot use; the next
          // candidate gets a turn. What matters is whether a request was built.
        }
        if (sent.length > 0) {
          recorded = sent[0];
          break;
        }
      }

      if (!recorded) {
        uncovered.push(name);
        continue;
      }

      const path = new URL(recorded.url).pathname;
      const hit = apiRoutes.some((r) => r.method === recorded!.method && r.regex.test(path));
      if (!hit) mismatched.push(`${name} -> ${recorded.method} ${path}`);
    }

    // Reported together rather than failing on the first, so one run tells you
    // everything that drifted rather than one thing at a time.
    expect({ mismatched, uncovered }).toEqual({ mismatched: [], uncovered: [] });
  }, 60000);

  it('sends the bearer token and the /api prefix on every request', async () => {
    const headersSeen: (string | null)[] = [];
    const client = createApiClient({
      baseUrl: 'http://contract.probe',
      getAccessToken: async () => 'probe-token',
      fetch: (async (url: string, init: { headers?: Headers }) => {
        headersSeen.push(new Headers(init?.headers).get('authorization'));
        expect(new URL(String(url)).pathname.startsWith('/api/')).toBe(true);
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as unknown as typeof fetch,
    });

    await client.catalog.listProducts({});
    await client.account.me();

    // The prefix is applied by the client, not by callers — a caller passing
    // '/api/...' itself would double it, which is why this is asserted here.
    expect(headersSeen).toEqual(['Bearer probe-token', 'Bearer probe-token']);
  });
});
