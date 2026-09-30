import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import {
  type FcmFailure,
  type PushContent,
  buildFcmMessage,
  classifyFcmError,
  describeFcmError,
} from './fcm-message';
import {
  GOOGLE_TOKEN_URL,
  type ServiceAccount,
  buildAssertion,
  parseServiceAccount,
} from './google-auth';

/** The outcome of one send. Never thrown: a dead token is an answer, not an error. */
export type FcmSendResult = { ok: true } | { ok: false; reason: FcmFailure; detail: string };

/** Refresh the access token this long before it actually expires. */
const TOKEN_SKEW_MS = 5 * 60_000;

/** Ceilings on the two calls, so a stalled Google endpoint cannot hold a request open. */
const TOKEN_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 10_000;

/**
 * Firebase Cloud Messaging sender (SPEC-11 B-1) — the push counterpart to
 * `SmsService` and `EmailService`.
 *
 * MISSING-CREDS CONTRACT, identical to `MpesaService`: the constructor never
 * touches the network and never throws. Without a usable service-account key
 * `isConfigured()` is false and `PushService` does nothing, so the API boots and
 * serves every other module — and every notification still goes out as SMS.
 *
 * NEVER THROWS FROM `send`. FCM failing is the normal case here — a customer
 * uninstalled the app, a token rotated, the network blinked — and callers need
 * the classification to decide what to do about it, not an exception to catch.
 *
 * NO `firebase-admin`. The HTTP v1 API needs a signed JWT exchanged for a bearer
 * token and one POST per message; see `google-auth.ts`.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly account: ServiceAccount | null;
  private readonly projectId: string | null;

  private tokenCache: { token: string; expiresAt: number } | null = null;
  /** Single-flight: a broadcast fires many sends at once, but needs ONE token fetch. */
  private tokenInFlight: Promise<string> | null = null;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true });
    this.account = parseServiceAccount(raw);
    this.projectId =
      config.get('FCM_PROJECT_ID', { infer: true }) || this.account?.project_id || null;

    // Set but unusable is a misconfiguration worth saying so about, once, without
    // echoing a value that contains a private key.
    if (raw?.trim() && !this.account) {
      this.logger.error(
        'FCM_SERVICE_ACCOUNT_JSON is set but is not a usable service-account key ' +
          '(expected the key file JSON or its base64). Push is disabled.',
      );
    } else if (this.account && !this.projectId) {
      this.logger.error(
        'The FCM service-account key has no project_id and FCM_PROJECT_ID is not set. ' +
          'Push is disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return this.account !== null && this.projectId !== null;
  }

  /** Sends one message to one device. */
  async send(token: string, content: PushContent): Promise<FcmSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'other', detail: 'FCM is not configured' };
    }

    // An access token can be revoked before it expires. One retry with a fresh
    // one, and only for that.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let bearer: string;
      try {
        bearer = await this.accessToken();
      } catch (err) {
        this.logger.error(`Could not obtain an FCM access token: ${(err as Error).message}`);
        return { ok: false, reason: 'auth', detail: 'could not obtain an access token' };
      }

      let response: Response;
      try {
        response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId!)}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bearer}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: buildFcmMessage(token, content) }),
            signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
          },
        );
      } catch (err) {
        return { ok: false, reason: 'unavailable', detail: (err as Error).message.slice(0, 200) };
      }

      if (response.ok) return { ok: true };

      const body = await response.json().catch(() => null);
      const reason = classifyFcmError(response.status, body);

      if (reason === 'auth' && attempt === 0) {
        this.tokenCache = null;
        continue;
      }
      return { ok: false, reason, detail: describeFcmError(response.status, body) };
    }

    return { ok: false, reason: 'auth', detail: 'access token refused twice' };
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - TOKEN_SKEW_MS > now) {
      return this.tokenCache.token;
    }
    // Everyone waiting on a refresh shares the one request.
    this.tokenInFlight ??= this.fetchAccessToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async fetchAccessToken(): Promise<string> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: buildAssertion(this.account!),
      }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !body.access_token) {
      // `error` is a short code (`invalid_grant`, …), safe to log; the request
      // body, which holds the signed assertion, is not.
      throw new Error(`token endpoint answered ${response.status} ${body.error ?? ''}`.trim());
    }

    const ttlSeconds =
      Number.isFinite(body.expires_in) && (body.expires_in as number) > 0
        ? (body.expires_in as number)
        : 3600;
    this.tokenCache = { token: body.access_token, expiresAt: Date.now() + ttlSeconds * 1000 };
    return body.access_token;
  }
}
