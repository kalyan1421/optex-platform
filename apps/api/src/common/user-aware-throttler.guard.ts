import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Rate-limit tracker that keys on the CALLER, not on the TCP peer.
 *
 * WHY THIS EXISTS (audit F-01). The default `ThrottlerGuard` keys every request
 * on `req.ip`. Browser traffic reaches this API through the Next.js `/api/*`
 * rewrite proxy (see `apps/web/next.config.js`), and production adds an ingress
 * hop on top — so with the stock tracker every customer in the country presents
 * the same address and shares ONE bucket. `main.ts` sets `trust proxy` so
 * anonymous traffic resolves to the real client, and authenticated traffic is
 * keyed per user below, which is what carrier-grade NAT on Kenyan mobile
 * networks makes necessary.
 *
 * WHY IT KEYS ON THE VERIFIED SUBJECT, NOT THE TOKEN STRING. The first version
 * hashed the raw bearer token, which made the bucket per-SESSION rather than
 * per-user, and — far worse — meant ANY string minted a fresh bucket. Measured
 * against the running API before this change: 310 requests with one junk token
 * returned 429, while rotating the junk token per request returned 60/60 not
 * throttled. Rate limiting was bypassable by anyone willing to send a random
 * `Authorization` header, with no credentials at all.
 *
 * So the signature is verified here — locally, HMAC only, no network — and the
 * bucket is the token's `sub`:
 *
 *   - a validly signed token  → `u:<sub>`, so a user cannot widen their own
 *     quota by re-authenticating, and their several devices share one ceiling;
 *   - anything else           → `ip:<addr>`, so forged and junk tokens fall
 *     back to the anonymous bucket instead of minting their own.
 *
 * Verifying rather than merely decoding matters for a second reason: an
 * unverified `sub` would let an attacker spend a VICTIM's quota by forging
 * their id. A forged token fails the HMAC and never reaches the user bucket.
 *
 * `exp` is deliberately not checked. An expired but validly signed token still
 * identifies whose it is, which is the only question being asked here — and
 * `SupabaseAuthGuard` rejects it a moment later regardless.
 *
 * STILL OPEN — MULTI-INSTANCE. The counters live in `ThrottlerStorageService`,
 * which is per-process, so N replicas allow N times the ceiling. Sharing them
 * needs a Redis-backed storage provider and there is no Redis in the stack;
 * `ThrottlerModule.forRoot` takes a `storage` option, so it is a one-line
 * change once there is. Worth knowing that the "single container" premise this
 * was originally accepted under may already be stale: migration 0021 added
 * cron leader election specifically so the API could run more than one replica.
 * That is a deployment decision, not a code one, which is why it is documented
 * here rather than papered over.
 */

const logger = new Logger('UserAwareThrottlerGuard');
let warnedMissingSecret = false;

/**
 * Returns the `sub` of a Supabase access token whose HS256 signature checks
 * out, or `null` for anything else — malformed, wrong algorithm, bad
 * signature, or no configured secret.
 *
 * Hand-rolled rather than pulling in a JWT library: this is one HMAC and one
 * constant-time compare, the API has no other need for one, and the narrower
 * surface is easier to reason about than a general-purpose verifier whose
 * defaults would have to be audited (`algorithms`, `none`, and so on).
 */
function verifiedSubject(token: string | null): string | null {
  if (!token) return null;

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      // Not fatal: the fallback is the anonymous IP bucket, which is stricter
      // than per-user, never looser. Worth saying out loud because it silently
      // costs signed-in users their own quota behind shared egress.
      logger.warn(
        'SUPABASE_JWT_SECRET is not set — rate limiting will key authenticated traffic by IP rather than by user.',
      );
    }
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  try {
    // Pin the algorithm. Accepting whatever the token declares is the classic
    // alg-confusion hole — `none` would make every signature "valid", and an
    // asymmetric alg would have us verify with the wrong key material.
    const header = JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8')) as {
      alg?: unknown;
    };
    if (header.alg !== 'HS256') return null;

    const expected = createHmac('sha256', secret)
      .update(`${headerSegment}.${payloadSegment}`)
      .digest();
    const actual = Buffer.from(signatureSegment, 'base64url');
    // timingSafeEqual throws on a length mismatch, so check that first — and
    // a wrong length is a wrong signature anyway.
    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function bearerFrom(req: Request): string | null {
  const header = req.headers?.['authorization'];
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  return token?.trim() || null;
}

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const subject = verifiedSubject(bearerFrom(req));
    if (subject) return `u:${subject}`;

    // Anonymous, forged, and junk-token traffic all land here. `main.ts` trusts
    // the forwarding hops, so this is the real client rather than the proxy.
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
