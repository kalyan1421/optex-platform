import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import { CustomerNotificationsService } from '../src/modules/customer-notifications/customer-notifications.service';
import { NotificationLogService } from '../src/modules/notifications/notification-log.service';
import { FcmService, type FcmSendResult } from '../src/modules/push/fcm.service';
import type { PushContent } from '../src/modules/push/fcm-message';

/**
 * Push notifications — SPEC-11 B-1: device registration, and delivery through the
 * real `notify()` fan-out.
 *
 * Google is the one thing faked, with a recorder: "what was sent to which device"
 * is exactly what is being asserted. Everything else — the HTTP layer, the
 * database, the ownership rules, the log — is real.
 */
jest.setTimeout(60_000);

describe('Push notifications (e2e)', () => {
  let app: INestApplication;
  let db: SupabaseClient;
  let notifications: CustomerNotificationsService;
  let notificationLog: NotificationLogService;

  const runId = `${Date.now()}`;
  const PASSWORD = 'TestPassword123!';
  const userIds: string[] = [];
  const customerIds: string[] = [];
  const productIds: string[] = [];
  let serialCounter = 0;

  /** Recording stand-in for Google. */
  const fcm = {
    configured: true,
    throws: false,
    sent: [] as Array<{ token: string; content: PushContent }>,
    results: new Map<string, FcmSendResult>(),
    reset() {
      this.configured = true;
      this.throws = false;
      this.sent = [];
      this.results.clear();
    },
    isConfigured() {
      return this.configured;
    },
    async send(token: string, content: PushContent): Promise<FcmSendResult> {
      this.sent.push({ token, content });
      if (this.throws) throw new Error('FCM exploded');
      return this.results.get(token) ?? { ok: true };
    },
  };

  interface Account {
    id: string;
    token: string;
    customerId: string;
  }

  async function newAccount(): Promise<Account> {
    const anon = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false } },
    );
    const email = `push-e2e-${runId}-${Math.floor(Math.random() * 100000)}@optex-test.local`;
    const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
    if (error) throw error;
    userIds.push(data.user!.id);

    const { data: customer, error: cErr } = await db
      .from('customers')
      .select('id')
      .eq('auth_user_id', data.user!.id)
      .single();
    if (cErr) throw cErr;
    customerIds.push(customer!.id);
    return { id: data.user!.id, token: data.session!.access_token, customerId: customer!.id };
  }

  /** A syntactically valid FCM-style token, unique to this run. */
  const deviceToken = (name: string) => `tok-${runId}-${name}-`.padEnd(40, 'x');

  const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

  const register = (a: Account, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/devices').set(auth(a)).send(body);

  const deregister = (a: Account, token: string) =>
    request(app.getHttpServer()).post('/api/devices/deregister').set(auth(a)).send({ token });

  const rowFor = async (token: string) =>
    (
      await db
        .from('device_tokens')
        .select('customer_id, platform, app_version, muted_categories, disabled_at, last_seen_at')
        .eq('token', token)
        .maybeSingle()
    ).data;

  const pushLogFor = async (recipient: string) =>
    (
      await db
        .from('notification_log')
        .select('channel, status, subject, attempts, last_error, next_retry_at')
        .eq('recipient', recipient)
    ).data ?? [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FcmService)
      .useValue(fcm)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    db = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } },
    );
    notifications = app.get(CustomerNotificationsService);
    notificationLog = app.get(NotificationLogService);
  });

  beforeEach(() => fcm.reset());

  afterAll(async () => {
    for (const id of customerIds) {
      await db.from('notification_log').delete().eq('recipient', `customer:${id}`);
    }
    await db.from('notification_log').delete().like('subject', `push-e2e-${runId}%`);
    await db.from('products').update({ is_active: false }).in('id', productIds);
    for (const id of userIds) await db.auth.admin.deleteUser(id);
    await app.close();
  });

  // ── Registration ───────────────────────────────────────────────────────────

  describe('registering a device', () => {
    it('requires a signed-in customer', async () => {
      await request(app.getHttpServer())
        .post('/api/devices')
        .send({ token: deviceToken('anon'), platform: 'ios' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/devices/deregister')
        .send({ token: deviceToken('anon') })
        .expect(401);
    });

    it('stores the device against the caller, from the JWT', async () => {
      const a = await newAccount();
      const token = deviceToken('reg');

      await register(a, { token, platform: 'android', appVersion: '1.0.0+3' }).expect(204);

      expect(await rowFor(token)).toMatchObject({
        customer_id: a.customerId,
        platform: 'android',
        app_version: '1.0.0+3',
        muted_categories: [],
        disabled_at: null,
      });
    });

    it('is idempotent, and refreshes the mute set and last-seen time', async () => {
      const a = await newAccount();
      const token = deviceToken('idem');
      await register(a, { token, platform: 'ios' }).expect(204);
      const first = await rowFor(token);

      await new Promise((r) => setTimeout(r, 15));
      await register(a, { token, platform: 'ios', mutedCategories: ['offer'] }).expect(204);

      const second = await rowFor(token);
      expect(second!.muted_categories).toEqual(['offer']);
      expect(new Date(second!.last_seen_at).getTime()).toBeGreaterThan(
        new Date(first!.last_seen_at).getTime(),
      );
      const { count } = await db
        .from('device_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('token', token);
      expect(count).toBe(1);
    });

    it('moves a device to whoever registers it next — the shared handset', async () => {
      const a = await newAccount();
      const b = await newAccount();
      const token = deviceToken('shared');

      await register(a, { token, platform: 'ios' }).expect(204);
      // A signs out without the deregister call landing; B signs in on the same phone.
      await register(b, { token, platform: 'ios' }).expect(204);

      expect((await rowFor(token))!.customer_id).toBe(b.customerId);

      // ...so A's next notification no longer reaches that phone.
      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-a`, 'for A');
      expect(fcm.sent.filter((s) => s.token === token)).toHaveLength(0);
      await notifications.notify(b.customerId, 'order', `push-e2e-${runId}-b`, 'for B');
      expect(fcm.sent.filter((s) => s.token === token)).toHaveLength(1);
    });

    it('brings a device FCM had given up on back to life', async () => {
      const a = await newAccount();
      const token = deviceToken('revive');
      await register(a, { token, platform: 'android' }).expect(204);
      await db
        .from('device_tokens')
        .update({ disabled_at: new Date().toISOString() })
        .eq('token', token);

      await register(a, { token, platform: 'android' }).expect(204);

      expect((await rowFor(token))!.disabled_at).toBeNull();
    });

    it.each([
      ['an unknown platform', { platform: 'windows-phone' }],
      ['no platform', { platform: undefined }],
      ['a token that is too short', { token: 'short' }],
      ['a token with whitespace in it', { token: `${'x'.repeat(30)} ${'y'.repeat(10)}` }],
      ['a token with a control character', { token: `${'x'.repeat(30)}\n${'y'.repeat(10)}` }],
      ['an oversized token', { token: 'x'.repeat(4097) }],
      ['an unknown muted category', { mutedCategories: ['marketing'] }],
      ['a repeated muted category', { mutedCategories: ['offer', 'offer'] }],
      ['muted categories that are not a list', { mutedCategories: 'offer' }],
      ['an oversized app version', { appVersion: '1'.repeat(33) }],
    ])('rejects %s', async (_label, override) => {
      const a = await newAccount();
      const body = { token: deviceToken('bad'), platform: 'ios', ...override };
      await register(a, body).expect(400);
    });

    it('rejects a missing token', async () => {
      const a = await newAccount();
      await register(a, { platform: 'ios' }).expect(400);
    });
  });

  describe('deregistering a device', () => {
    it("removes the caller's own registration", async () => {
      const a = await newAccount();
      const token = deviceToken('dereg');
      await register(a, { token, platform: 'ios' }).expect(204);

      await deregister(a, token).expect(204);

      expect(await rowFor(token)).toBeNull();
    });

    it("never touches someone else's device, and does not say whether it exists", async () => {
      const owner = await newAccount();
      const other = await newAccount();
      const token = deviceToken('theirs');
      await register(owner, { token, platform: 'ios' }).expect(204);

      // Same answer for a device that is not theirs, and one that does not exist.
      await deregister(other, token).expect(204);
      await deregister(other, deviceToken('nonexistent')).expect(204);

      expect((await rowFor(token))!.customer_id).toBe(owner.customerId);
    });

    it('stops notifications reaching the device', async () => {
      const a = await newAccount();
      const token = deviceToken('stop');
      await register(a, { token, platform: 'ios' }).expect(204);
      await deregister(a, token).expect(204);

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-stop`, 'body');

      expect(fcm.sent).toHaveLength(0);
    });
  });

  // ── Delivery ───────────────────────────────────────────────────────────────

  describe('delivery through notify()', () => {
    it('sends the feed entry to every live device, with the payload the app expects', async () => {
      const a = await newAccount();
      const phone = deviceToken('d1-phone');
      const tablet = deviceToken('d1-tablet');
      await register(a, { token: phone, platform: 'android' }).expect(204);
      await register(a, { token: tablet, platform: 'ios' }).expect(204);

      const title = `push-e2e-${runId}-deliver`;
      await notifications.notify(
        a.customerId,
        'order',
        title,
        'We have your order',
        '/orders/abc/tracking',
      );

      expect(fcm.sent.map((s) => s.token).sort()).toEqual([phone, tablet].sort());

      const { content } = fcm.sent[0];
      expect(content).toMatchObject({
        category: 'order',
        title,
        body: 'We have your order',
        link: '/orders/abc/tracking',
      });

      // `notificationId` is the feed row this push mirrors, so a tap can open it.
      const { data: feed } = await db
        .from('customer_notifications')
        .select('id')
        .eq('customer_id', a.customerId)
        .eq('title', title)
        .single();
      expect(content.notificationId).toBe(feed!.id);
    });

    it('records the attempt in notification_log as a push, beside SMS and email', async () => {
      const a = await newAccount();
      await register(a, { token: deviceToken('log'), platform: 'ios' }).expect(204);

      const title = `push-e2e-${runId}-log`;
      await notifications.notify(a.customerId, 'appointment', title, 'See you soon');

      const rows = await pushLogFor(`customer:${a.customerId}`);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        channel: 'push',
        status: 'sent',
        subject: title,
        attempts: 1,
        last_error: null,
      });
    });

    it('honours a muted category server-side — it is never sent, not merely hidden', async () => {
      const a = await newAccount();
      const token = deviceToken('muted');
      await register(a, { token, platform: 'ios', mutedCategories: ['offer'] }).expect(204);

      await notifications.notify(a.customerId, 'offer', `push-e2e-${runId}-m1`, '10% off');
      expect(fcm.sent).toHaveLength(0);

      // Muting one category leaves the others alone.
      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-m2`, 'placed');
      expect(fcm.sent).toHaveLength(1);
    });

    it('does not consider a muted send an attempt, so it is not logged as a failure', async () => {
      const a = await newAccount();
      await register(a, {
        token: deviceToken('mutelog'),
        platform: 'ios',
        mutedCategories: ['offer'],
      });

      await notifications.notify(a.customerId, 'offer', `push-e2e-${runId}-ml`, 'x');

      expect(await pushLogFor(`customer:${a.customerId}`)).toHaveLength(0);
    });

    it('mutes per device: one handset opted out, the other still receives', async () => {
      const a = await newAccount();
      const quiet = deviceToken('quiet');
      const loud = deviceToken('loud');
      await register(a, { token: quiet, platform: 'ios', mutedCategories: ['order'] });
      await register(a, { token: loud, platform: 'android' });

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-pd`, 'x');

      expect(fcm.sent.map((s) => s.token)).toEqual([loud]);
    });

    it("never sends to another customer's device", async () => {
      const a = await newAccount();
      const b = await newAccount();
      await register(a, { token: deviceToken('a-only'), platform: 'ios' });
      const bToken = deviceToken('b-only');
      await register(b, { token: bToken, platform: 'ios' });

      await notifications.notify(b.customerId, 'order', `push-e2e-${runId}-iso`, 'x');

      expect(fcm.sent.map((s) => s.token)).toEqual([bToken]);
    });

    it('skips a disabled device', async () => {
      const a = await newAccount();
      const token = deviceToken('disabled');
      await register(a, { token, platform: 'ios' });
      await db
        .from('device_tokens')
        .update({ disabled_at: new Date().toISOString() })
        .eq('token', token);

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-dis`, 'x');

      expect(fcm.sent).toHaveLength(0);
    });

    it('sends nothing to a deactivated customer', async () => {
      const a = await newAccount();
      await register(a, { token: deviceToken('deact'), platform: 'ios' });
      await db
        .from('customers')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', a.customerId);

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-deact`, 'x');

      expect(fcm.sent).toHaveLength(0);
    });
  });

  describe('when a send fails', () => {
    it('switches off a token FCM reports dead, so the next notification does not try it', async () => {
      const a = await newAccount();
      const dead = deviceToken('dead');
      const alive = deviceToken('alive');
      await register(a, { token: dead, platform: 'android' });
      await register(a, { token: alive, platform: 'ios' });
      fcm.results.set(dead, { ok: false, reason: 'unregistered', detail: '404 UNREGISTERED' });

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-d1`, 'x');
      expect((await rowFor(dead))!.disabled_at).not.toBeNull();
      expect((await rowFor(alive))!.disabled_at).toBeNull();

      fcm.sent = [];
      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-d2`, 'y');
      expect(fcm.sent.map((s) => s.token)).toEqual([alive]);
    });

    it.each(['unavailable', 'quota', 'auth', 'other'] as const)(
      'leaves the token enabled after a %s failure — it says nothing about the device',
      async (reason) => {
        const a = await newAccount();
        const token = deviceToken(`keep-${reason}`);
        await register(a, { token, platform: 'ios' });
        fcm.results.set(token, { ok: false, reason, detail: reason });

        await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-k${reason}`, 'x');

        expect((await rowFor(token))!.disabled_at).toBeNull();
      },
    );

    it('logs a total failure as abandoned, with the reason', async () => {
      const a = await newAccount();
      const token = deviceToken('allfail');
      await register(a, { token, platform: 'ios' });
      fcm.results.set(token, { ok: false, reason: 'unavailable', detail: '503 UNAVAILABLE' });

      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-af`, 'x');

      const rows = await pushLogFor(`customer:${a.customerId}`);
      expect(rows[0]).toMatchObject({
        channel: 'push',
        status: 'abandoned',
        last_error: expect.stringContaining('503 UNAVAILABLE'),
      });
    });

    it('still writes the feed entry, and does not throw, when FCM blows up', async () => {
      const a = await newAccount();
      await register(a, { token: deviceToken('boom'), platform: 'ios' });
      fcm.throws = true;
      const title = `push-e2e-${runId}-boom`;

      await expect(
        notifications.notify(a.customerId, 'order', title, 'x'),
      ).resolves.toBeUndefined();

      const { data } = await db
        .from('customer_notifications')
        .select('id')
        .eq('customer_id', a.customerId)
        .eq('title', title);
      expect(data).toHaveLength(1);
    });

    it('does nothing, and the feed still works, when FCM is not configured', async () => {
      const a = await newAccount();
      await register(a, { token: deviceToken('unconf'), platform: 'ios' });
      fcm.configured = false;
      const title = `push-e2e-${runId}-unconf`;

      await notifications.notify(a.customerId, 'order', title, 'x');

      expect(fcm.sent).toHaveLength(0);
      expect(await pushLogFor(`customer:${a.customerId}`)).toHaveLength(0);
      const { data } = await db
        .from('customer_notifications')
        .select('id')
        .eq('customer_id', a.customerId)
        .eq('title', title);
      expect(data).toHaveLength(1);
    });
  });

  describe('a broadcast', () => {
    it('reaches every device that has not muted offers, and no other', async () => {
      const a = await newAccount();
      const b = await newAccount();
      const c = await newAccount();
      const aTok = deviceToken('bc-a');
      const bTok = deviceToken('bc-b');
      const cTok = deviceToken('bc-c');
      await register(a, { token: aTok, platform: 'ios' });
      await register(b, { token: bTok, platform: 'android', mutedCategories: ['offer'] });
      await register(c, { token: cTok, platform: 'ios', mutedCategories: ['order'] });

      const title = `push-e2e-${runId}-offer`;
      await notifications.notifyAllCustomers('offer', title, 'Big sale', '/shop');

      // Other suites leave devices behind; look only at this test's own.
      const mine = fcm.sent.filter((s) => [aTok, bTok, cTok].includes(s.token)).map((s) => s.token);
      expect(mine.sort()).toEqual([aTok, cTok].sort());
      expect(
        fcm.sent.every((s) => s.content.category === 'offer' && s.content.link === '/shop'),
      ).toBe(true);

      // One summary row for the whole fan-out.
      const { data: summary } = await db
        .from('notification_log')
        .select('recipient, channel, status')
        .eq('subject', title);
      expect(summary).toEqual([{ recipient: 'broadcast:offer', channel: 'push', status: 'sent' }]);
    });

    it('skips a deactivated customer, as the feed fan-out does', async () => {
      const a = await newAccount();
      const token = deviceToken('bc-deact');
      await register(a, { token, platform: 'ios' });
      await db
        .from('customers')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', a.customerId);

      await notifications.notifyAllCustomers('offer', `push-e2e-${runId}-bcd`, 'x');

      expect(fcm.sent.map((s) => s.token)).not.toContain(token);
    });
  });

  // ── The log and the retry sweep ────────────────────────────────────────────

  describe('the retry sweep', () => {
    it('can never claim a push row, whatever state it is in', async () => {
      // The sweep re-sends anything `pending` or `failed` as SMS, or — for any
      // channel that is not `sms` — as an EMAIL. A push row reaching it would be
      // sent to somebody as an email. `recordPush` only writes terminal statuses;
      // this proves the query is safe even against a row that is not.
      const { data: bait, error } = await db
        .from('notification_log')
        .insert({
          channel: 'push',
          recipient: `customer:${runId}-bait`,
          subject: `push-e2e-${runId}-bait`,
          body: 'must never be retried',
          status: 'failed',
          attempts: 1,
          next_retry_at: new Date(Date.now() - 60_000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>();
      if (error) throw error;

      const due = await notificationLog.claimDue(1000);

      expect(due.map((r) => r.id)).not.toContain(bait!.id);
      await db.from('notification_log').delete().eq('id', bait!.id);
    });

    it('still claims a due SMS — the filter did not swallow the real work', async () => {
      const { data: sms, error } = await db
        .from('notification_log')
        .insert({
          channel: 'sms',
          recipient: `+254700${runId.slice(-6)}`,
          body: 'retry me',
          status: 'failed',
          attempts: 1,
          next_retry_at: new Date(Date.now() - 60_000).toISOString(),
        })
        .select('id')
        .single<{ id: string }>();
      if (error) throw error;

      const due = await notificationLog.claimDue(1000);

      expect(due.map((r) => r.id)).toContain(sms!.id);
      await db.from('notification_log').delete().eq('id', sms!.id);
    });

    it('never leaves a push it wrote in a state the sweep would pick up', async () => {
      const a = await newAccount();
      await register(a, { token: deviceToken('terminal'), platform: 'ios' });
      await notifications.notify(a.customerId, 'order', `push-e2e-${runId}-term`, 'x');

      const rows = await pushLogFor(`customer:${a.customerId}`);
      expect(rows).toHaveLength(1);
      expect(['sent', 'abandoned']).toContain(rows[0].status);
      expect(rows[0].next_retry_at).toBeNull();
    });
  });

  // ── The whole chain ────────────────────────────────────────────────────────

  describe('from a real checkout to a phone', () => {
    let categoryId: string;
    let branchId: string;

    beforeAll(async () => {
      // An existing category, not one of our own — see order-source.e2e-spec.ts.
      const { data: cat } = await db
        .from('categories')
        .select('id')
        .not('slug', 'like', 'e2e-%')
        .not('slug', 'like', 'zz-%')
        .limit(1)
        .single<{ id: string }>();
      categoryId = cat!.id;
      const { data: branch } = await db
        .from('branches')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single<{ id: string }>();
      branchId = branch!.id;
    });

    async function stockedProduct(): Promise<string> {
      const { data, error } = await db
        .from('products')
        .insert({
          slug: `e2e-push-${runId}-${Math.floor(Math.random() * 100000)}`,
          sku: `E2E-PUSH-${runId}-${Math.floor(Math.random() * 100000)}`,
          name: 'Push fixture',
          category_id: categoryId,
          price_kes: 5000,
          is_active: true,
        })
        .select('id')
        .single<{ id: string }>();
      if (error) throw error;
      productIds.push(data.id);
      await db.from('inventory').update({ stock: 0 }).eq('product_id', data.id);
      await db.from('product_serials').insert({
        product_id: data.id,
        serial_number: `E2E-PUSH-SERIAL-${runId}-${serialCounter++}-${Math.floor(Math.random() * 1_000_000)}`,
        status: 'in_stock',
        current_branch_id: branchId,
      });
      await db
        .from('inventory')
        .update({ stock: 1 })
        .eq('product_id', data.id)
        .eq('branch_id', branchId);
      return data.id;
    }

    it('an order placed in the app reaches the customer’s phone, ready to deep-link', async () => {
      const a = await newAccount();
      const token = deviceToken('checkout');
      await register(a, { token, platform: 'android' }).expect(204);

      const productId = await stockedProduct();
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set(auth(a))
        .send({ productId, quantity: 1 })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/api/checkout')
        .set(auth(a))
        .set({ 'X-Optex-Client': 'android' })
        .send({
          paymentMethod: 'mpesa',
          deliveryOption: 'delivery',
          shippingAddress: {
            name: 'Push Tester',
            phone: '0712345678',
            address: '1 Test Road',
            city: 'Nairobi',
            county: 'Nairobi',
          },
        })
        .expect(201);

      // `notify()` is fired without being awaited by checkout, so give it a beat.
      const orderId = res.body.order.id as string;
      for (let i = 0; i < 40 && fcm.sent.filter((s) => s.token === token).length === 0; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
      }

      const delivered = fcm.sent.filter((s) => s.token === token);
      expect(delivered).toHaveLength(1);
      expect(delivered[0].content).toMatchObject({
        category: 'order',
        // The path the app's deep-link resolver understands.
        link: `/orders/${orderId}/tracking`,
      });
      expect(delivered[0].content.title).toMatch(/placed/i);
    });
  });
});
