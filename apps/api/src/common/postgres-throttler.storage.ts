import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * The shape `ThrottlerStorage.increment` must resolve to.
 *
 * Declared here rather than imported: `@nestjs/throttler` exports
 * `ThrottlerStorageRecord` only from `dist/throttler-storage-record.interface`,
 * not from the package root, and reaching into `dist/` would break on any
 * internal reshuffle. `ThrottlerStorage` is satisfied structurally, so a local
 * declaration that matches is equivalent and stable — `implements
 * ThrottlerStorage` below still fails the build if the upstream contract
 * changes.
 */
interface ThrottlerRecord {
  totalHits: number;
  /** Seconds until the current window ends. */
  timeToExpire: number;
  isBlocked: boolean;
  /** Seconds until an active block lifts; 0 when not blocked. */
  timeToBlockExpire: number;
}

/**
 * Rate-limit counters kept in Postgres so every replica shares one bucket.
 *
 * WHY THIS EXISTS (P-02). `ThrottlerModule` defaults to
 * `ThrottlerStorageService`, an in-memory `Map` scoped to one Node process.
 * `UserAwareThrottlerGuard` already documented what that costs under "STILL
 * OPEN — MULTI-INSTANCE", and the production sweep on 7 Sep 2026 measured it:
 * 40 failed `POST /api/auth/login` in one minute, against a configured ceiling
 * of 10/min, produced a single 429. Login had no effective brute-force limit.
 *
 * Redis remains the right long-term home — this is a database write per
 * counted request, which is real cost at real traffic. But there is no Redis
 * in the stack, standing one up is an infrastructure decision with an owner
 * and a bill, and an imperfectly-enforced ceiling beats an unenforced one.
 * Postgres is already shared by every replica, and the hit is a single upsert
 * on a primary key (migration 0040, `throttler_hit`), on an UNLOGGED table.
 *
 * FAILURE MODE IS DELIBERATELY OPEN. If the database call fails, this returns
 * a record that permits the request rather than throwing. A throttler that
 * takes the whole API down when its bookkeeping is unavailable trades a rate
 * limit for an outage, which is the worse of the two — so a storage failure
 * degrades to today's behaviour (no shared limit) and is logged, rather than
 * turning every request into a 500.
 */
@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(PostgresThrottlerStorage.name);

  /**
   * Rate-limits the failure logging itself. A database outage would otherwise
   * emit one error line per request, which buries the cause under its own
   * symptoms.
   */
  private lastFailureLoggedAt = 0;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Records one hit against `key` and reports the resulting bucket state.
   *
   * `throttlerName` is part of the composite key so a route-level
   * `@Throttle({ default: … })` override shares the bucket its name implies —
   * which is what lets the auth endpoints tighten the `default` bucket for
   * themselves without every other route inheriting the tighter limit.
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const compositeKey = `${throttlerName}-${key}`;

    try {
      const { data, error } = await this.supabase.client.rpc('throttler_hit', {
        p_key: compositeKey,
        p_ttl_ms: ttl,
        p_limit: limit,
        p_block_ms: blockDuration,
      });

      if (error) {
        throw new Error(error.message);
      }

      // `rpc` on a set-returning function yields an array; the function always
      // returns exactly one row.
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        throw new Error('throttler_hit returned no row');
      }

      return {
        totalHits: Number(row.total_hits),
        timeToExpire: Math.ceil(Number(row.time_to_expire_ms) / 1000),
        isBlocked: Boolean(row.is_blocked),
        timeToBlockExpire: Math.ceil(Number(row.time_to_block_expire_ms) / 1000),
      };
    } catch (err) {
      this.logFailure(err);
      // Fail open — see the class comment.
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  /** Removes long-expired rows. Called from the scheduled jobs, not per request. */
  async sweep(): Promise<number> {
    const { data, error } = await this.supabase.client.rpc('throttler_sweep');
    if (error) {
      throw new Error(error.message);
    }
    return Number(data ?? 0);
  }

  /** At most one line a minute while storage is unavailable. */
  private logFailure(err: unknown): void {
    const now = Date.now();
    if (now - this.lastFailureLoggedAt < 60_000) return;
    this.lastFailureLoggedAt = now;
    this.logger.error(
      `Throttler storage unavailable — rate limits are NOT being enforced: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
