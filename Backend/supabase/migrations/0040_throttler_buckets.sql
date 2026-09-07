-- 0040_throttler_buckets.sql
--
-- P-02. Shared rate-limit counters, so the configured ceilings actually hold.
--
-- WHAT WAS MEASURED. Against the live API on 7 Sep 2026: 40 failed
-- POST /api/auth/login in one minute, against a configured limit of 10/min,
-- produced exactly ONE 429. Login had, in practice, no brute-force ceiling.
--
-- WHY. `ThrottlerModule` defaults to `ThrottlerStorageService`, an in-memory
-- Map inside a single Node process. `user-aware-throttler.guard.ts` already
-- documented the consequence under "STILL OPEN — MULTI-INSTANCE": N replicas
-- allow N times the ceiling, because each replica counts only its own share of
-- the traffic. That was accepted under a single-container premise which the
-- deployment has since outgrown — the same premise migration 0021 already
-- stopped relying on when it gave the cron jobs leader election.
--
-- WHY POSTGRES AND NOT REDIS. The guard's comment names Redis as the eventual
-- fix, and for a high-traffic API it still is: this is a write per counted
-- request. But there is no Redis in this stack, adding one is an
-- infrastructure decision with a cost and an owner, and the ceiling being
-- enforced imperfectly today beats it not being enforced at all. Postgres is
-- already here, already shared by every replica, and the write is a single
-- upsert on a primary key. `ThrottlerModule.forRoot` takes a `storage` option,
-- so swapping this for Redis later is the same one-line change the guard's
-- comment describes.
--
-- WHY UNLOGGED. These rows are disposable by definition — every one of them
-- expires within its TTL, and losing the table's contents in a crash costs at
-- most one window of rate limiting. UNLOGGED skips the WAL, which is most of
-- the write cost, and keeps this off the replication stream.

create unlogged table if not exists throttler_buckets (
  -- The throttler's own composite key: `<bucket-name>-<tracker>`, where the
  -- tracker is `u:<sub>` for a validly-signed token or `ip:<addr>` otherwise.
  -- See `UserAwareThrottlerGuard.getTracker`.
  key           text        primary key,

  -- Hits recorded in the current window.
  hits          integer     not null default 0,

  -- When the current window ends. A row whose `expires_at` has passed is
  -- treated as absent and reset on the next hit, so an expired bucket never
  -- needs deleting to stop counting.
  expires_at    timestamptz not null,

  -- When the caller's block ends, for throttlers configured with a block
  -- duration. Null when not blocked.
  blocked_until timestamptz
);

-- Only ever used by the sweeper below. The primary key serves every hit.
create index if not exists throttler_buckets_expires_at_idx
  on throttler_buckets (expires_at);

comment on table throttler_buckets is
  'Shared rate-limit counters for @nestjs/throttler (P-02). UNLOGGED and disposable; rows expire by expires_at.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Record one hit and return the resulting state, atomically.
--
-- Doing this in SQL rather than as read-then-write from Node is the whole
-- point: two replicas handling two login attempts at the same instant would
-- otherwise both read the same count and both write count+1, and the ceiling
-- would leak exactly when it is under attack. The upsert makes the read and
-- the increment one statement, and the row lock serialises concurrent hits on
-- the same key.
--
-- `p_ttl_ms` is the window length; `p_block_ms` how long to hold a caller out
-- once they exceed `p_limit` (0 = no separate block, the window itself is the
-- penalty).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function throttler_hit(
  p_key      text,
  p_ttl_ms   bigint,
  p_limit    integer,
  p_block_ms bigint
)
returns table (
  total_hits            integer,
  time_to_expire_ms     bigint,
  is_blocked            boolean,
  time_to_block_expire_ms bigint
)
language plpgsql
as $$
declare
  v_now         timestamptz := clock_timestamp();
  v_hits        integer;
  v_expires     timestamptz;
  v_blocked     timestamptz;
begin
  insert into throttler_buckets as b (key, hits, expires_at, blocked_until)
  values (p_key, 1, v_now + make_interval(secs => p_ttl_ms / 1000.0), null)
  on conflict (key) do update
    set
      -- A window that has already ended starts a fresh one at 1 rather than
      -- continuing to accumulate; otherwise a bucket would never recover.
      hits = case
               when b.expires_at <= v_now then 1
               else b.hits + 1
             end,
      expires_at = case
                     when b.expires_at <= v_now
                       then v_now + make_interval(secs => p_ttl_ms / 1000.0)
                     else b.expires_at
                   end,
      -- Clear a block that has run its course, so the caller is let back in.
      blocked_until = case
                        when b.blocked_until is not null and b.blocked_until <= v_now
                          then null
                        else b.blocked_until
                      end
  returning b.hits, b.expires_at, b.blocked_until
  into v_hits, v_expires, v_blocked;

  -- Over the limit and not already serving a block → start one.
  if p_block_ms > 0 and v_hits > p_limit and v_blocked is null then
    update throttler_buckets
       set blocked_until = v_now + make_interval(secs => p_block_ms / 1000.0)
     where key = p_key
     returning blocked_until into v_blocked;
  end if;

  return query
  select
    v_hits,
    greatest(0, (extract(epoch from (v_expires - v_now)) * 1000))::bigint,
    (v_blocked is not null and v_blocked > v_now),
    case
      when v_blocked is not null and v_blocked > v_now
        then greatest(0, (extract(epoch from (v_blocked - v_now)) * 1000))::bigint
      else 0::bigint
    end;
end;
$$;

comment on function throttler_hit(text, bigint, integer, bigint) is
  'Atomically records a rate-limit hit and returns the bucket state (P-02).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Sweeper. Expired rows are already ignored by `throttler_hit`, so this is
-- purely about not letting the table grow without bound — every distinct IP
-- and user id that ever hits the API leaves a row behind.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function throttler_sweep()
returns integer
language plpgsql
as $$
declare
  v_deleted integer;
begin
  delete from throttler_buckets
   where expires_at < now() - interval '1 hour'
     and (blocked_until is null or blocked_until < now());
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function throttler_sweep() is
  'Deletes long-expired throttler buckets. Called from the API cron (P-02).';

-- Service-role only, matching migration 0025's posture: the API is the sole
-- writer and `apps/admin` never touches Postgres directly. RLS on with no
-- policies means anon and authenticated get nothing.
alter table throttler_buckets enable row level security;
