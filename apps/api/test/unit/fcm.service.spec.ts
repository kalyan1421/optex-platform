import { Logger } from '@nestjs/common';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { FcmService } from '../../src/modules/push/fcm.service';
import type { PushContent } from '../../src/modules/push/fcm-message';

/**
 * `FcmService` against a stubbed `fetch` (SPEC-11 B-1): the OAuth exchange, the
 * message POST, and — because a broadcast fires many sends at once — what happens
 * under concurrency.
 */

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const KEY_FILE = JSON.stringify({
  type: 'service_account',
  project_id: 'optex-opticians',
  client_email: 'fcm-sender@optex-opticians.iam.gserviceaccount.com',
  private_key: privateKey,
});

const CONTENT: PushContent = {
  category: 'order',
  title: 'Order placed',
  body: 'Thanks',
  link: '/orders/abc/tracking',
};

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as never;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const isTokenCall = (url: string) => url === TOKEN_URL;
const isSendCall = (url: string) => url.startsWith('https://fcm.googleapis.com/');

interface Call {
  url: string;
  init: RequestInit;
}

/** Stubs fetch with a handler, recording every call. */
function stubFetch(
  handler: (url: string, init: RequestInit, n: number) => Response | Promise<Response>,
) {
  const calls: Call[] = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {}, calls.length);
  });
  return calls;
}

const okToken = (n = 1) => json(200, { access_token: `access-${n}`, expires_in: 3600 });

describe('FcmService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('configuration', () => {
    it('is configured with a usable key', () => {
      expect(new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: KEY_FILE })).isConfigured()).toBe(
        true,
      );
    });

    it('is configured with the same key base64-encoded', () => {
      const b64 = Buffer.from(KEY_FILE).toString('base64');
      expect(new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: b64 })).isConfigured()).toBe(true);
    });

    it('is not configured without a key, and says nothing about it', () => {
      const fcm = new FcmService(config({}));
      expect(fcm.isConfigured()).toBe(false);
      // Unset is a normal state (push off), not a misconfiguration.
      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });

    it('is not configured with an unusable key, and logs it once WITHOUT echoing the value', () => {
      const secret = 'not-a-key-but-imagine-it-were-secret-material';
      const fcm = new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: secret }));

      expect(fcm.isConfigured()).toBe(false);
      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
      const logged = (Logger.prototype.error as jest.Mock).mock.calls.flat().join(' ');
      expect(logged).toContain('FCM_SERVICE_ACCOUNT_JSON');
      expect(logged).not.toContain(secret);
    });

    it('is not configured when there is no project id anywhere', () => {
      const { project_id: _omit, ...rest } = JSON.parse(KEY_FILE);
      const fcm = new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(rest) }));
      expect(fcm.isConfigured()).toBe(false);
    });

    it('takes the project id from FCM_PROJECT_ID when the key has none', async () => {
      const { project_id: _omit, ...rest } = JSON.parse(KEY_FILE);
      const calls = stubFetch((url) => (isTokenCall(url) ? okToken() : json(200, {})));
      const fcm = new FcmService(
        config({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(rest), FCM_PROJECT_ID: 'from-env' }),
      );

      await fcm.send('tok', CONTENT);

      expect(calls.find((c) => isSendCall(c.url))!.url).toBe(
        'https://fcm.googleapis.com/v1/projects/from-env/messages:send',
      );
    });

    it('does not call Google at all when unconfigured', async () => {
      const calls = stubFetch(() => json(200, {}));
      const result = await new FcmService(config({})).send('tok', CONTENT);

      expect(result).toMatchObject({ ok: false, reason: 'other' });
      expect(calls).toHaveLength(0);
    });
  });

  describe('a send', () => {
    const fcm = () => new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: KEY_FILE }));

    it('exchanges a signed assertion for a token, then posts the message with it', async () => {
      const calls = stubFetch((url) => (isTokenCall(url) ? okToken() : json(200, { name: 'm' })));

      const result = await fcm().send('device-token', CONTENT);
      expect(result).toEqual({ ok: true });

      const [tokenCall, sendCall] = calls;
      // The OAuth request: a JWT-bearer grant whose assertion the matching public key verifies.
      const form = new URLSearchParams(String(tokenCall.init.body));
      expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      const [h, c, s] = form.get('assertion')!.split('.');
      expect(
        createVerify('RSA-SHA256')
          .update(`${h}.${c}`)
          .verify(publicKey, Buffer.from(s, 'base64url')),
      ).toBe(true);

      // The message: bearer auth, the project in the URL, the device in the body.
      expect(sendCall.url).toBe(
        'https://fcm.googleapis.com/v1/projects/optex-opticians/messages:send',
      );
      expect((sendCall.init.headers as Record<string, string>).Authorization).toBe(
        'Bearer access-1',
      );
      const body = JSON.parse(String(sendCall.init.body));
      expect(body.message.token).toBe('device-token');
      expect(body.message.data).toMatchObject({ category: 'order', link: '/orders/abc/tracking' });
    });

    it('sends every request with a timeout so a stalled endpoint cannot hold a caller open', async () => {
      const calls = stubFetch((url) => (isTokenCall(url) ? okToken() : json(200, {})));
      await fcm().send('t', CONTENT);
      for (const call of calls) expect(call.init.signal).toBeInstanceOf(AbortSignal);
    });

    it('reuses the access token across sends', async () => {
      const calls = stubFetch((url) => (isTokenCall(url) ? okToken() : json(200, {})));
      const service = fcm();

      await service.send('a', CONTENT);
      await service.send('b', CONTENT);
      await service.send('c', CONTENT);

      expect(calls.filter((c) => isTokenCall(c.url))).toHaveLength(1);
      expect(calls.filter((c) => isSendCall(c.url))).toHaveLength(3);
    });

    it('fetches ONE token for a burst of concurrent sends — what a broadcast does', async () => {
      const calls = stubFetch(async (url) => {
        // The token endpoint is slow, so every send is waiting on it at once.
        if (isTokenCall(url)) {
          await new Promise((r) => setTimeout(r, 30));
          return okToken();
        }
        return json(200, {});
      });
      const service = fcm();

      const results = await Promise.all(
        Array.from({ length: 25 }, (_, i) => service.send(`tok-${i}`, CONTENT)),
      );

      expect(results.every((r) => r.ok)).toBe(true);
      expect(calls.filter((c) => isTokenCall(c.url))).toHaveLength(1);
      expect(calls.filter((c) => isSendCall(c.url))).toHaveLength(25);
    });

    it('fetches a fresh token once the old one is within five minutes of expiry', async () => {
      jest.useFakeTimers({
        now: Date.UTC(2026, 8, 30, 12, 0, 0),
        doNotFake: ['setTimeout', 'queueMicrotask'],
      });
      let n = 0;
      const calls = stubFetch((url) => (isTokenCall(url) ? okToken(++n) : json(200, {})));
      const service = fcm();

      await service.send('a', CONTENT);
      jest.setSystemTime(Date.UTC(2026, 8, 30, 12, 50, 0)); // 50 of 60 minutes: still good
      await service.send('b', CONTENT);
      expect(calls.filter((c) => isTokenCall(c.url))).toHaveLength(1);

      jest.setSystemTime(Date.UTC(2026, 8, 30, 12, 57, 0)); // inside the 5-minute skew
      await service.send('c', CONTENT);
      expect(calls.filter((c) => isTokenCall(c.url))).toHaveLength(2);
      expect((calls.at(-1)!.init.headers as Record<string, string>).Authorization).toBe(
        'Bearer access-2',
      );
    });
  });

  describe('failures', () => {
    const fcm = () => new FcmService(config({ FCM_SERVICE_ACCOUNT_JSON: KEY_FILE }));
    const fcmError = (status: number, code: string, errorCode?: string) =>
      json(status, {
        error: {
          code: status,
          status: code,
          message: 'nope',
          details: errorCode ? [{ errorCode }] : [],
        },
      });

    it('reports a dead token as unregistered — an answer, not an exception', async () => {
      stubFetch((url) =>
        isTokenCall(url) ? okToken() : fcmError(404, 'NOT_FOUND', 'UNREGISTERED'),
      );
      await expect(fcm().send('dead', CONTENT)).resolves.toMatchObject({
        ok: false,
        reason: 'unregistered',
      });
    });

    it('reports a network failure as unavailable and does not throw', async () => {
      stubFetch((url) => {
        if (isTokenCall(url)) return okToken();
        throw new TypeError('fetch failed');
      });
      await expect(fcm().send('t', CONTENT)).resolves.toMatchObject({
        ok: false,
        reason: 'unavailable',
      });
    });

    it('retries ONCE with a fresh token when Google refuses the access token', async () => {
      let sends = 0;
      const calls = stubFetch((url) => {
        if (isTokenCall(url)) return okToken(calls.filter((c) => isTokenCall(c.url)).length);
        sends += 1;
        return sends === 1 ? fcmError(401, 'UNAUTHENTICATED') : json(200, {});
      });

      await expect(fcm().send('t', CONTENT)).resolves.toEqual({ ok: true });

      expect(calls.filter((c) => isTokenCall(c.url))).toHaveLength(2);
      expect(sends).toBe(2);
    });

    it('gives up after that one retry rather than looping on a revoked key', async () => {
      const calls = stubFetch((url) =>
        isTokenCall(url) ? okToken() : fcmError(401, 'UNAUTHENTICATED'),
      );

      await expect(fcm().send('t', CONTENT)).resolves.toMatchObject({ ok: false, reason: 'auth' });
      expect(calls.filter((c) => isSendCall(c.url))).toHaveLength(2);
    });

    it('reports a refused token exchange as an auth failure, and never posts a message', async () => {
      const calls = stubFetch(() => json(400, { error: 'invalid_grant' }));

      await expect(fcm().send('t', CONTENT)).resolves.toMatchObject({ ok: false, reason: 'auth' });
      expect(calls.filter((c) => isSendCall(c.url))).toHaveLength(0);
    });

    it('does not log the signed assertion or the private key when the exchange fails', async () => {
      stubFetch(() => json(400, { error: 'invalid_grant' }));
      await fcm().send('t', CONTENT);

      const logged = (Logger.prototype.error as jest.Mock).mock.calls.flat().join(' ');
      expect(logged).not.toContain('PRIVATE KEY');
      expect(logged).not.toContain(privateKey.slice(40, 80));
      expect(logged).toContain('invalid_grant');
    });

    it('classifies a quota error and a server error without throwing', async () => {
      stubFetch((url) =>
        isTokenCall(url) ? okToken() : fcmError(429, 'RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED'),
      );
      await expect(fcm().send('t', CONTENT)).resolves.toMatchObject({ reason: 'quota' });

      jest.restoreAllMocks();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      stubFetch((url) => (isTokenCall(url) ? okToken() : json(503, {})));
      await expect(fcm().send('t', CONTENT)).resolves.toMatchObject({ reason: 'unavailable' });
    });

    it('never puts the device token into its failure detail', async () => {
      stubFetch((url) =>
        isTokenCall(url) ? okToken() : fcmError(404, 'NOT_FOUND', 'UNREGISTERED'),
      );
      const result = await fcm().send('SECRET-DEVICE-TOKEN-VALUE', CONTENT);
      expect(JSON.stringify(result)).not.toContain('SECRET-DEVICE-TOKEN-VALUE');
    });
  });
});
