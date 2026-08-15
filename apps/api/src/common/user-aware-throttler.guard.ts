import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { Request } from 'express';

/**
 * Rate-limit tracker that keys on the CALLER, not on the TCP peer.
 *
 * WHY THIS EXISTS (audit F-01). The default `ThrottlerGuard` keys every request
 * on `req.ip`. Browser traffic reaches this API through the Next.js `/api/*`
 * rewrite proxy (see `apps/web/next.config.js`), and production adds an ingress
 * hop on top — so with the stock tracker every customer in the country presents
 * the same address and shares ONE 100-request-per-minute bucket. Measured before
 * the fix: 115 sequential requests from a single client returned 98×200 / 17×429,
 * and a distinct `X-Forwarded-For` per request changed nothing.
 *
 * Two changes close it:
 *
 *   1. `main.ts` now sets `trust proxy`, so `req.ip` resolves through
 *      `X-Forwarded-For` to the real client for ANONYMOUS traffic.
 *   2. This tracker keys AUTHENTICATED traffic on the bearer token instead of
 *      the address, so signed-in customers get their own bucket even when they
 *      share an egress IP — which is the norm on Kenyan mobile networks behind
 *      carrier-grade NAT, where IP-keyed limiting would lump thousands of
 *      unrelated shoppers together.
 *
 * The token is SHA-256'd and truncated before it becomes a key: the throttler
 * storage is a plain in-memory map, and raw access tokens do not belong in it.
 *
 * NOTE ON MULTI-INSTANCE. The storage is still `ThrottlerStorageService`, which
 * is per-process — two API replicas each allow the full quota. That is a
 * deliberate limit of the current single-container deployment, not an oversight;
 * sharing the counter across replicas needs a Redis-backed storage provider, and
 * there is no Redis in the stack today. `ThrottlerModule.forRoot` takes a
 * `storage` option, so swapping it is a one-line change when Redis arrives.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const header = req.headers?.['authorization'];
    if (typeof header === 'string') {
      const [scheme, token] = header.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token?.trim()) {
        // Per-session bucket. Hashed so the storage map never holds a usable
        // credential; truncated because 128 bits is ample for a bucket key.
        return `u:${createHash('sha256').update(token.trim()).digest('hex').slice(0, 32)}`;
      }
    }

    // Anonymous traffic falls back to the address, which is now the real client
    // rather than the proxy because `main.ts` trusts the forwarding hops.
    return `ip:${req.ip ?? 'unknown'}`;
  }
}
