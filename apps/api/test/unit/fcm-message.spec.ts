import {
  PUSH_TTL_SECONDS,
  buildFcmMessage,
  classifyFcmError,
  describeFcmError,
  isPermanentTokenFailure,
  isSenderProblem,
} from '../../src/modules/push/fcm-message';

/**
 * The push payload contract with the mobile app, and what an FCM failure means
 * (SPEC-11 B-1).
 *
 * The payload half is pinned from both sides: the Flutter suite has a test that
 * feeds `PushPayload.fromData` the exact `data` block asserted here, so a key
 * renamed on either side fails a test rather than quietly degrading every tap to
 * "opens the notification centre".
 */

const TOKEN = 'fcm-token-abcdefghijklmnopqrstuvwxyz';
const ORDER_ID = '11111111-2222-3333-4444-555555555555';

describe('buildFcmMessage', () => {
  const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

  const order = buildFcmMessage(
    TOKEN,
    {
      category: 'order',
      title: 'Order OPT-1 placed',
      body: "We've received your order.",
      link: `/orders/${ORDER_ID}/tracking`,
      notificationId: 'nid-1',
    },
    NOW,
  );

  it('addresses one device', () => {
    expect(order.token).toBe(TOKEN);
  });

  it('carries a notification block, so a backgrounded or killed app still shows it', () => {
    expect(order.notification).toEqual({
      title: 'Order OPT-1 placed',
      body: "We've received your order.",
    });
  });

  it('carries the data block the app reads to route the tap', () => {
    // These key names are the contract. Keep in step with `PushPayload.fromData`
    // (apps/mobile/lib/features/engagement/domain/push_payload.dart).
    expect(order.data).toEqual({
      category: 'order',
      link: `/orders/${ORDER_ID}/tracking`,
      notificationId: 'nid-1',
    });
  });

  it('sends only strings in data — FCM rejects anything else', () => {
    for (const v of Object.values(order.data)) expect(typeof v).toBe('string');
  });

  it('omits a link or notification id it does not have rather than sending "null"', () => {
    const bare = buildFcmMessage(TOKEN, { category: 'offer', title: 't', body: 'b' });
    expect(bare.data).toEqual({ category: 'offer' });
    expect(Object.keys(bare.data)).not.toContain('link');
  });

  it.each(['order', 'appointment', 'offer'] as const)(
    'routes %s into the Android channel the app creates for it',
    (category) => {
      // The app creates `optex_<category>` on start-up. A channel it never
      // created would silently land in a default one, and the customer's
      // system-settings switches would stop controlling what they claim to.
      const m = buildFcmMessage(TOKEN, { category, title: 't', body: 'b' });
      expect(m.android.notification.channel_id).toBe(`optex_${category}`);
    },
  );

  it('asks for high priority so it is not deferred by Doze', () => {
    expect(order.android.priority).toBe('HIGH');
    expect(order.apns.headers['apns-priority']).toBe('10');
  });

  it('gives an appointment reminder a short life — one that arrives late is worse than none', () => {
    const appt = buildFcmMessage(TOKEN, { category: 'appointment', title: 't', body: 'b' }, NOW);
    expect(appt.android.ttl).toBe('7200s');
    expect(PUSH_TTL_SECONDS.appointment).toBeLessThan(PUSH_TTL_SECONDS.order);
  });

  it('sets the APNs expiry as an absolute epoch-seconds time, not a duration', () => {
    expect(order.apns.headers['apns-expiration']).toBe(
      String(Math.floor(NOW / 1000) + PUSH_TTL_SECONDS.order),
    );
  });

  it('plays the default sound on iOS', () => {
    expect(order.apns.payload.aps.sound).toBe('default');
  });

  it('keeps an oversized headline inside the payload limit', () => {
    const long = 'x'.repeat(5000);
    const m = buildFcmMessage(TOKEN, { category: 'offer', title: long, body: long });
    expect(m.notification.title.length).toBeLessThanOrEqual(100);
    expect(m.notification.body.length).toBeLessThanOrEqual(240);
    expect(JSON.stringify(m).length).toBeLessThan(4096);
    expect(m.notification.title.endsWith('…')).toBe(true);
  });

  it('does not clip a message that fits', () => {
    const m = buildFcmMessage(TOKEN, { category: 'order', title: '  hello  ', body: 'world' });
    expect(m.notification).toEqual({ title: 'hello', body: 'world' });
  });
});

/** The body FCM v1 sends on failure. */
const fcmError = (status: string, errorCode?: string, message = 'boom') => ({
  error: {
    code: 0,
    message,
    status,
    details: errorCode
      ? [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode }]
      : [],
  },
});

describe('classifyFcmError', () => {
  it.each([
    [404, fcmError('NOT_FOUND', 'UNREGISTERED'), 'unregistered'],
    [404, fcmError('NOT_FOUND'), 'unregistered'],
    [403, fcmError('PERMISSION_DENIED', 'SENDER_ID_MISMATCH'), 'sender_mismatch'],
    [401, fcmError('UNAUTHENTICATED'), 'auth'],
    [429, fcmError('RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED'), 'quota'],
    [429, fcmError('RESOURCE_EXHAUSTED'), 'quota'],
    [503, fcmError('UNAVAILABLE', 'UNAVAILABLE'), 'unavailable'],
    [500, fcmError('INTERNAL', 'INTERNAL'), 'unavailable'],
    [502, {}, 'unavailable'],
  ])('reads %s %j as %s', (status, body, expected) => {
    expect(classifyFcmError(status, body)).toBe(expected);
  });

  it('lets the specific error code win over a reused HTTP status', () => {
    // FCM reuses 403 for a token from the wrong project (about the token) AND
    // for a service account that has lost a permission (about every send).
    expect(classifyFcmError(403, fcmError('PERMISSION_DENIED', 'SENDER_ID_MISMATCH'))).toBe(
      'sender_mismatch',
    );
    expect(classifyFcmError(403, fcmError('PERMISSION_DENIED'))).toBe('other');
  });

  it('treats a 400 as "other" — it may be our payload, not the token', () => {
    expect(classifyFcmError(400, fcmError('INVALID_ARGUMENT', 'INVALID_ARGUMENT'))).toBe('other');
  });

  it.each([null, undefined, 'html error page', 42, [], {}])(
    'does not throw on an unparseable body (%j)',
    (body) => {
      expect(() => classifyFcmError(418, body)).not.toThrow();
      expect(classifyFcmError(418, body)).toBe('other');
    },
  );
});

describe('what a failure proves', () => {
  it('only an unregistered or wrong-project token is permanently dead', () => {
    expect(isPermanentTokenFailure('unregistered')).toBe(true);
    expect(isPermanentTokenFailure('sender_mismatch')).toBe(true);
  });

  // The important negative. Disabling on any of these would let a single bad
  // deploy, an FCM outage or an expired credential switch off the whole fleet.
  it.each(['other', 'auth', 'quota', 'unavailable'] as const)(
    'never disables a token because of %s',
    (reason) => {
      expect(isPermanentTokenFailure(reason)).toBe(false);
    },
  );

  it('recognises trouble with the sender, which says nothing about any token', () => {
    expect(isSenderProblem('auth')).toBe(true);
    expect(isSenderProblem('quota')).toBe(true);
    expect(isSenderProblem('unavailable')).toBe(true);
    expect(isSenderProblem('unregistered')).toBe(false);
    expect(isSenderProblem('other')).toBe(false);
  });
});

describe('describeFcmError', () => {
  it('summarises a failure for the log', () => {
    expect(describeFcmError(404, fcmError('NOT_FOUND', 'UNREGISTERED', 'Requested entity'))).toBe(
      '404 UNREGISTERED: Requested entity',
    );
  });

  it('copes with a body it does not understand, and stays short', () => {
    expect(describeFcmError(502, '<html>bad gateway</html>')).toBe('502 UNKNOWN');
    expect(describeFcmError(400, fcmError('X', undefined, 'y'.repeat(2000))).length).toBeLessThan(
      301,
    );
  });
});
