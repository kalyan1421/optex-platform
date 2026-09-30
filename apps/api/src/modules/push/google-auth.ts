/**
 * Google service-account authentication, without a client library (SPEC-11 B-1).
 *
 * FCM's HTTP v1 API takes an OAuth2 bearer token, which a service account mints
 * by signing a short-lived JWT and exchanging it at Google's token endpoint. That
 * is a `node:crypto` signature and a `fetch` — about forty lines — against the
 * alternative of `firebase-admin`, which drags a large dependency tree into an
 * API that otherwise needs none of it. It is the same approach `MpesaService`
 * takes to Daraja's OAuth.
 *
 * Pure, so the JWT can be verified against the matching public key in a test:
 * a wrong claim or a wrong signature would otherwise show up only as Google
 * refusing us in production.
 */

import { createSign } from 'node:crypto';

/** The fields of a Google service-account key file this code uses. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

/** The single OAuth scope FCM sending needs. */
export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Where the signed assertion is exchanged for an access token. */
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Google's maximum assertion lifetime. */
const ASSERTION_TTL_SECONDS = 3600;

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * Reads a service-account key from an env value.
 *
 * Accepts the JSON itself or its base64 encoding — a multi-line secret is
 * awkward in some hosting dashboards, and base64 sidesteps quoting entirely.
 *
 * Returns `null` for anything unusable and NEVER throws or logs the value: it
 * contains a private key, and a malformed one must not end up in a log line.
 */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;

  const attempts = [text];
  // Not JSON on its face: try it as base64.
  if (!text.startsWith('{')) {
    try {
      attempts.push(Buffer.from(text, 'base64').toString('utf8'));
    } catch {
      // fall through
    }
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as Partial<ServiceAccount>;
      if (
        typeof parsed.client_email === 'string' &&
        parsed.client_email.includes('@') &&
        typeof parsed.private_key === 'string' &&
        parsed.private_key.includes('BEGIN PRIVATE KEY')
      ) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key,
          project_id: typeof parsed.project_id === 'string' ? parsed.project_id : undefined,
        };
      }
    } catch {
      // try the next form
    }
  }
  return null;
}

/**
 * Builds the signed JWT assertion Google's token endpoint exchanges for an
 * access token.
 */
export function buildAssertion(
  account: ServiceAccount,
  nowMs: number = Date.now(),
  scope: string = FCM_SCOPE,
): string {
  const iat = Math.floor(nowMs / 1000);

  const signingInput = [
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    b64url(
      JSON.stringify({
        iss: account.client_email,
        scope,
        aud: GOOGLE_TOKEN_URL,
        iat,
        exp: iat + ASSERTION_TTL_SECONDS,
      }),
    ),
  ].join('.');

  const signature = createSign('RSA-SHA256').update(signingInput).sign(account.private_key);
  return `${signingInput}.${b64url(signature)}`;
}
