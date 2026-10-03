/**
 * Message construction and error classification for the FCM HTTP v1 API
 * (SPEC-11 B-1).
 *
 * Pure — no I/O — so the payload contract with the app and the rules for what a
 * failure means can be unit-tested directly. `FcmService` is the thin shell that
 * actually talks to Google.
 */

import type { NotificationCategory } from '../customer-notifications/dto/notification-query.dto';

/** What to tell the customer, and where tapping it should land. */
export interface PushContent {
  category: NotificationCategory;
  title: string;
  body: string;
  /**
   * An in-app path — `/orders/{id}/tracking`, `/appointments`, `/shop` — in the
   * vocabulary the notification feed already uses and the app already resolves
   * (`DeepLinks.resolve` in the mobile engagement slice). Anything else the app
   * simply falls back from to the notification centre.
   */
  link?: string | null;
  /** The `customer_notifications.id` this push mirrors, when there is one. */
  notificationId?: string | null;
}

/** The FCM v1 `message` object for one device token. */
export interface FcmMessage {
  token: string;
  notification: { title: string; body: string };
  /** FCM requires every value to be a string. */
  data: Record<string, string>;
  android: {
    priority: 'HIGH';
    ttl: string;
    notification: { channel_id: string };
  };
  apns: {
    headers: Record<string, string>;
    payload: { aps: { sound: string } };
  };
}

/**
 * How long FCM keeps trying to deliver, per category.
 *
 * A reminder that arrives hours late is worse than one that never arrives —
 * "your appointment is in an hour" delivered after the appointment reads as a
 * bug — so appointments get a short life. Orders and offers stay relevant for a
 * day. (The SMS that goes out alongside is the safety net either way.)
 */
export const PUSH_TTL_SECONDS: Record<NotificationCategory, number> = {
  appointment: 2 * 60 * 60,
  order: 24 * 60 * 60,
  offer: 24 * 60 * 60,
};

/** FCM caps a whole message at 4KB; these leave generous room for the rest. */
const MAX_TITLE = 100;
const MAX_BODY = 240;

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Builds the message for one device.
 *
 * TWO PARTS, DELIBERATELY. The `notification` block is what makes the OS draw
 * the message while the app is in the background or killed — it needs no Dart
 * code to run. The `data` block is what the app reads to route the tap, and to
 * decide whether to display a foreground message at all (its mute check reads
 * `category`). A data-only message would leave a killed app silent.
 *
 * The Android `channel_id` is `optex_<category>`, matching the channels the app
 * creates on start-up, so a background message lands in the same per-category
 * channel a foreground one does — and the customer's system-settings switches
 * for Orders, Appointments and Offers actually control what they claim to.
 * Naming a channel the app never created would silently drop it into a default
 * one.
 */
export function buildFcmMessage(
  token: string,
  content: PushContent,
  nowMs: number = Date.now(),
): FcmMessage {
  const ttl = PUSH_TTL_SECONDS[content.category];

  const data: Record<string, string> = { category: content.category };
  if (content.link) data.link = content.link;
  if (content.notificationId) data.notificationId = content.notificationId;

  return {
    token,
    notification: {
      title: clip(content.title, MAX_TITLE),
      body: clip(content.body, MAX_BODY),
    },
    data,
    android: {
      priority: 'HIGH',
      ttl: `${ttl}s`,
      notification: { channel_id: `optex_${content.category}` },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        // APNs wants an absolute epoch-seconds expiry, not a duration.
        'apns-expiration': String(Math.floor(nowMs / 1000) + ttl),
      },
      payload: { aps: { sound: 'default' } },
    },
  };
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Why a send did not deliver, in terms of what to DO about it. */
export type FcmFailure =
  /** The token is dead: the app was uninstalled or its data cleared. */
  | 'unregistered'
  /** The token belongs to another Firebase project (a dev build, say). */
  | 'sender_mismatch'
  /** Our own access token was refused. */
  | 'auth'
  | 'quota'
  /** FCM is having a bad moment. */
  | 'unavailable'
  /** Anything else — including a 400, which may be OUR payload, not the token. */
  | 'other';

/**
 * Whether a failure proves THIS token can never work again.
 *
 * Deliberately narrow. `INVALID_ARGUMENT` (HTTP 400) is NOT here: it means
 * "something in the request is wrong", which is as likely to be our payload as
 * the token, and disabling on it would let one bad deploy switch off every
 * device in the fleet. Only the two answers that are about the token alone.
 */
export function isPermanentTokenFailure(reason: FcmFailure): boolean {
  return reason === 'unregistered' || reason === 'sender_mismatch';
}

/** Whether a failure says something is wrong with the SENDER rather than the token. */
export function isSenderProblem(reason: FcmFailure): boolean {
  return reason === 'auth' || reason === 'quota' || reason === 'unavailable';
}

interface FcmErrorBody {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ errorCode?: string }>;
  };
}

/** The `FcmError.errorCode` FCM attaches to a failure, when it does. */
function errorCodeOf(body: unknown): string | null {
  const details = (body as FcmErrorBody | null)?.error?.details;
  if (!Array.isArray(details)) return null;
  for (const d of details) {
    if (typeof d?.errorCode === 'string') return d.errorCode;
  }
  return null;
}

/** A short, log-safe description of a failure. Never includes the token. */
export function describeFcmError(status: number, body: unknown): string {
  const err = (body as FcmErrorBody | null)?.error;
  const code = errorCodeOf(body) ?? err?.status ?? 'UNKNOWN';
  const message = typeof err?.message === 'string' ? err.message : '';
  return `${status} ${code}${message ? `: ${message}` : ''}`.slice(0, 300);
}

/**
 * Reads an FCM failure response.
 *
 * The specific `errorCode` wins over the HTTP status, because FCM reuses
 * statuses: a 404 is UNREGISTERED, but a 403 might be a token from the wrong
 * project (SENDER_ID_MISMATCH — about the token) or a service account that has
 * lost its permission (PERMISSION_DENIED — about us, and about every send).
 */
export function classifyFcmError(status: number, body: unknown): FcmFailure {
  const code = errorCodeOf(body);

  if (code === 'UNREGISTERED') return 'unregistered';
  if (code === 'SENDER_ID_MISMATCH') return 'sender_mismatch';
  if (code === 'QUOTA_EXCEEDED') return 'quota';
  if (code === 'UNAVAILABLE' || code === 'INTERNAL') return 'unavailable';

  if (status === 404) return 'unregistered';
  if (status === 401) return 'auth';
  if (status === 429) return 'quota';
  if (status >= 500) return 'unavailable';
  return 'other';
}
