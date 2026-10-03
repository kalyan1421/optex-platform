import { Logger } from '@nestjs/common';
import { PushService } from '../../src/modules/push/push.service';
import type { FcmSendResult } from '../../src/modules/push/fcm.service';
import type { PushContent } from '../../src/modules/push/fcm-message';

/**
 * `PushService` against fakes (SPEC-11 B-1): which tokens it sends to, which it
 * switches off, what it records, and how a broadcast behaves when things go
 * wrong. The database half is `push-delivery.e2e-spec.ts`.
 */

const CONTENT: PushContent = { category: 'order', title: 'Order placed', body: 'Thanks' };
const OK: FcmSendResult = { ok: true };
const fail = (reason: Extract<FcmSendResult, { ok: false }>['reason']): FcmSendResult => ({
  ok: false,
  reason,
  detail: `${reason} detail`,
});

interface Harness {
  service: PushService;
  send: jest.Mock;
  activeTokens: jest.Mock;
  activePage: jest.Mock;
  disable: jest.Mock;
  recordPush: jest.Mock;
}

function harness(opts: {
  configured?: boolean;
  tokens?: string[];
  pages?: string[][];
  send?: (token: string) => FcmSendResult | Promise<FcmSendResult>;
}): Harness {
  const send = jest.fn(async (token: string) => (opts.send ? opts.send(token) : OK));

  const activeTokens = jest.fn(async () => opts.tokens ?? []);

  const pages = [...(opts.pages ?? [])];
  const activePage = jest.fn(async () => {
    const next = pages.shift() ?? [];
    return next.map((token, i) => ({ id: `${token}-id${i}`, token }));
  });

  const disable = jest.fn(async () => undefined);
  const recordPush = jest.fn(async () => undefined);

  const service = new PushService(
    { activeTokens, activePage, disable } as never,
    { isConfigured: () => opts.configured ?? true, send } as never,
    { recordPush } as never,
  );
  return { service, send, activeTokens, activePage, disable, recordPush };
}

describe('PushService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('pushToCustomer', () => {
    it('does nothing at all when FCM is not configured', async () => {
      const h = harness({ configured: false, tokens: ['a'] });

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 0,
        delivered: 0,
      });
      expect(h.activeTokens).not.toHaveBeenCalled();
      expect(h.send).not.toHaveBeenCalled();
    });

    it('asks only for devices that have not muted this category', async () => {
      const h = harness({ tokens: [] });
      await h.service.pushToCustomer('c1', { ...CONTENT, category: 'offer' });
      expect(h.activeTokens).toHaveBeenCalledWith('c1', 'offer');
    });

    it('sends nothing and records nothing for a customer with no device to send to', async () => {
      const h = harness({ tokens: [] });

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 0,
        delivered: 0,
      });
      expect(h.send).not.toHaveBeenCalled();
      // Nothing was attempted, so there is nothing to account for: the SMS is
      // this customer's channel.
      expect(h.recordPush).not.toHaveBeenCalled();
    });

    it('sends to every device and records one row for the notification', async () => {
      const h = harness({ tokens: ['phone', 'tablet'] });

      const outcome = await h.service.pushToCustomer('c1', CONTENT);

      expect(outcome).toEqual({ attempted: 2, delivered: 2 });
      expect(h.send).toHaveBeenCalledTimes(2);
      expect(h.recordPush).toHaveBeenCalledTimes(1);
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'customer:c1',
          subject: 'Order placed',
          attempted: 2,
          delivered: 2,
          error: null,
        }),
      );
    });

    it('counts a partial delivery honestly', async () => {
      const h = harness({
        tokens: ['good', 'bad'],
        send: (t) => (t === 'good' ? OK : fail('unavailable')),
      });

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 2,
        delivered: 1,
      });
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({
          attempted: 2,
          delivered: 1,
          error: 'unavailable: unavailable detail',
        }),
      );
    });

    it('switches off a token FCM says is dead — and only that one', async () => {
      const h = harness({
        tokens: ['alive', 'dead'],
        send: (t) => (t === 'dead' ? fail('unregistered') : OK),
      });

      await h.service.pushToCustomer('c1', CONTENT);

      expect(h.disable).toHaveBeenCalledTimes(1);
      expect(h.disable).toHaveBeenCalledWith(['dead']);
    });

    it('also switches off a token that belongs to another Firebase project', async () => {
      const h = harness({ tokens: ['devbuild'], send: () => fail('sender_mismatch') });
      await h.service.pushToCustomer('c1', CONTENT);
      expect(h.disable).toHaveBeenCalledWith(['devbuild']);
    });

    // The important negatives. Each of these is about this send, or about us —
    // never proof that the device is gone — and acting on any of them would let
    // one bad deploy, an outage or an expired credential switch off working
    // devices for good.
    it.each(['other', 'auth', 'quota', 'unavailable'] as const)(
      'leaves every token alone after a %s failure',
      async (reason) => {
        const h = harness({ tokens: ['a', 'b'], send: () => fail(reason) });

        await h.service.pushToCustomer('c1', CONTENT);

        expect(h.disable).not.toHaveBeenCalled();
      },
    );

    it('records a total failure as such', async () => {
      const h = harness({ tokens: ['a'], send: () => fail('other') });

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 1,
        delivered: 0,
      });
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({ delivered: 0, error: 'other: other detail' }),
      );
    });

    it('never throws when the token lookup fails', async () => {
      const h = harness({ tokens: ['a'] });
      h.activeTokens.mockRejectedValueOnce(new Error('db down'));

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 0,
        delivered: 0,
      });
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('still reports the send when switching off a dead token fails', async () => {
      const h = harness({ tokens: ['dead'], send: () => fail('unregistered') });
      h.disable.mockRejectedValueOnce(new Error('db down'));

      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toEqual({
        attempted: 1,
        delivered: 0,
      });
      expect(h.recordPush).toHaveBeenCalled();
    });

    it('never throws when recording the attempt fails', async () => {
      const h = harness({ tokens: ['a'] });
      h.recordPush.mockRejectedValueOnce(new Error('log down'));
      await expect(h.service.pushToCustomer('c1', CONTENT)).resolves.toBeDefined();
    });
  });

  describe('broadcast', () => {
    const tokens = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`);

    it('does nothing when FCM is not configured', async () => {
      const h = harness({ configured: false, pages: [['a']] });
      await expect(h.service.broadcast(CONTENT)).resolves.toEqual({ attempted: 0, delivered: 0 });
      expect(h.activePage).not.toHaveBeenCalled();
    });

    it('walks every page, sends to every device, and records ONE summary row', async () => {
      const h = harness({ pages: [tokens('p1-', 3), tokens('p2-', 2)] });

      const outcome = await h.service.broadcast({ ...CONTENT, category: 'offer' });

      expect(outcome).toEqual({ attempted: 5, delivered: 5 });
      expect(h.send).toHaveBeenCalledTimes(5);
      expect(h.recordPush).toHaveBeenCalledTimes(1);
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'broadcast:offer',
          attempted: 5,
          delivered: 5,
          error: null,
        }),
      );
    });

    it('pages by keyset — each page starts after the last id of the one before', async () => {
      const h = harness({ pages: [tokens('a', 2), tokens('b', 2)] });
      await h.service.broadcast(CONTENT);

      const afters = h.activePage.mock.calls.map((c) => c[1]);
      expect(afters[0]).toBeNull();
      expect(afters[1]).toBe('a1-id1');
      expect(afters).toHaveLength(3); // two full pages, then the empty one that ends it
    });

    it('never has more than 25 sends in flight at once', async () => {
      let inFlight = 0;
      let peak = 0;
      const h = harness({
        pages: [tokens('t', 120)],
        send: async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, 2));
          inFlight -= 1;
          return OK;
        },
      });

      await h.service.broadcast(CONTENT);

      expect(peak).toBeLessThanOrEqual(25);
      expect(peak).toBeGreaterThan(1); // it IS concurrent, not one at a time
      expect(h.send).toHaveBeenCalledTimes(120);
    });

    it('switches off the dead tokens it finds, page by page', async () => {
      const h = harness({
        pages: [
          ['ok1', 'dead1'],
          ['dead2', 'ok2'],
        ],
        send: (t) => (t.startsWith('dead') ? fail('unregistered') : OK),
      });

      const outcome = await h.service.broadcast(CONTENT);

      expect(outcome).toEqual({ attempted: 4, delivered: 2 });
      expect(h.disable).toHaveBeenNthCalledWith(1, ['dead1']);
      expect(h.disable).toHaveBeenNthCalledWith(2, ['dead2']);
    });

    it('carries on past dead tokens — they say nothing about the sender', async () => {
      const h = harness({
        pages: [tokens('a', 3), tokens('b', 3)],
        send: () => fail('unregistered'),
      });

      await h.service.broadcast(CONTENT);

      expect(h.activePage).toHaveBeenCalledTimes(3);
    });

    it('STOPS when FCM is down rather than hammering it across every remaining device', async () => {
      const h = harness({
        pages: [tokens('a', 5), tokens('b', 5), tokens('c', 5)],
        send: () => fail('unavailable'),
      });

      const outcome = await h.service.broadcast(CONTENT);

      expect(outcome).toEqual({ attempted: 5, delivered: 0 });
      // One page tried, none after it.
      expect(h.activePage).toHaveBeenCalledTimes(1);
      expect(h.send).toHaveBeenCalledTimes(5);
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('stopped early') }),
      );
    });

    it.each(['auth', 'quota'] as const)(
      'also stops on %s — that is about us, not a device',
      async (reason) => {
        const h = harness({ pages: [tokens('a', 3), tokens('b', 3)], send: () => fail(reason) });
        await h.service.broadcast(CONTENT);
        expect(h.activePage).toHaveBeenCalledTimes(1);
      },
    );

    it('does NOT stop for a partly failing page — some devices are simply flaky', async () => {
      const h = harness({
        pages: [tokens('a', 4), tokens('b', 4)],
        send: (t) => (t === 'a0' ? fail('unavailable') : OK),
      });

      const outcome = await h.service.broadcast(CONTENT);

      expect(outcome).toEqual({ attempted: 8, delivered: 7 });
    });

    it('survives the token source failing part-way, keeping what it already sent', async () => {
      const h = harness({ pages: [tokens('a', 3)] });
      h.activePage
        .mockImplementationOnce(async () =>
          tokens('a', 3).map((token, i) => ({ id: `id${i}`, token })),
        )
        .mockRejectedValueOnce(new Error('db down'));

      const outcome = await h.service.broadcast(CONTENT);

      expect(outcome).toEqual({ attempted: 3, delivered: 3 });
      expect(h.recordPush).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('db down') }),
      );
    });

    it('records nothing when there was nobody to send to', async () => {
      const h = harness({ pages: [] });
      await expect(h.service.broadcast(CONTENT)).resolves.toEqual({ attempted: 0, delivered: 0 });
      expect(h.recordPush).not.toHaveBeenCalled();
    });
  });
});
