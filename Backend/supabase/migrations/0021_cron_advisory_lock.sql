-- ─────────────────────────────────────────────────────────────────────────────
-- 0021_cron_advisory_lock.sql
--
-- Closes audit finding F-05: the scheduled jobs had no distributed lock, so the
-- API could not safely run more than one instance.
--
-- CONTEXT
--   All three `@Cron` jobs run in-process via `@nestjs/schedule`. With two
--   replicas, every job fires on every replica at the same moment:
--
--     mpesa-status-polling    → the same pending transactions re-queried twice
--     appointment-reminders   → the customer gets the reminder SMS twice
--     cancellation-auto-decline → two sweeps racing the same rows
--
--   This is not merely untidy. Horizontal scaling is the natural remedy for
--   F-01's rate-limit pressure, so this finding was the thing standing between
--   the platform and its own scaling story.
--
-- WHY A SESSION LOCK, NOT A TRANSACTION LOCK
--   `pg_try_advisory_lock` (session-scoped) is deliberately NOT used here: the
--   Supabase client runs over PostgREST, where "session" is a pooled connection
--   we neither own nor can reliably unlock. `pg_try_advisory_xact_lock` is
--   scoped to the surrounding transaction and released automatically when it
--   ends, which is the only shape that is safe over a pooler.
--
--   The consequence is that the lock must be held BY a transaction that spans
--   the work. A cron job making many separate PostgREST calls cannot do that,
--   so instead of locking around the work we take a short lock to claim a
--   TIME SLOT: `try_claim_cron_run(job, interval)` records that this instance
--   owns this job for the next interval, and returns false to everyone else.
--   That is leader election with a lease, not mutual exclusion — the right
--   trade for idempotent sweeps that would merely duplicate work, and it needs
--   no connection affinity.
--
-- NOTE
--   The appointment reminder job additionally gained real per-row idempotency
--   in 0022 (F-04), so a duplicate run there is now harmless regardless. This
--   lease is the general guard for all three.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── Lease table ─────────────────────────────────────────────────────────────

create table if not exists cron_runs (
  job         text primary key,
  claimed_at  timestamptz not null default now(),
  claimed_by  text
);

comment on table cron_runs is
  'Leader-election leases for scheduled jobs. One row per job; the holder owns that job until the lease expires (F-05).';

-- ─── Claim a run ─────────────────────────────────────────────────────────────
--
-- Returns true to exactly one caller per `p_lease` window, false to everyone
-- else. The advisory lock serialises concurrent claims on the same job; the
-- timestamp comparison decides whether the lease has actually expired.
--
-- Both happen inside this single function call, which PostgREST runs as one
-- transaction — so the xact lock covers precisely the read-modify-write that
-- needs protecting, and is released the moment the function returns.

create or replace function try_claim_cron_run(
  p_job    text,
  p_lease  interval,
  p_runner text default null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_claimed_at timestamptz;
BEGIN
  -- Serialise claims for THIS job only. Unrelated jobs hash elsewhere and do
  -- not queue behind each other.
  PERFORM pg_advisory_xact_lock(hashtext('cron:' || p_job));

  SELECT claimed_at INTO v_claimed_at
  FROM   cron_runs
  WHERE  job = p_job;

  -- Someone else holds an unexpired lease.
  IF FOUND AND v_claimed_at > now() - p_lease THEN
    RETURN false;
  END IF;

  INSERT INTO cron_runs (job, claimed_at, claimed_by)
  VALUES (p_job, now(), p_runner)
  ON CONFLICT (job) DO UPDATE
    SET claimed_at = now(),
        claimed_by = excluded.claimed_by;

  RETURN true;
END;
$$;

comment on function try_claim_cron_run(text, interval, text) is
  'Leader election with a lease. Returns true to exactly one caller per window so a scheduled job runs once across all API replicas (F-05).';

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Same posture as 0010: the API calls this with the service-role key, and
-- nothing else has any business claiming a cron lease.

revoke execute on function public.try_claim_cron_run(text, interval, text) from public;
revoke execute on function public.try_claim_cron_run(text, interval, text) from anon;
revoke execute on function public.try_claim_cron_run(text, interval, text) from authenticated;
grant  execute on function public.try_claim_cron_run(text, interval, text) to service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Operational bookkeeping. No customer or admin UI reads it; the service-role
-- client bypasses RLS, so enabling it with no policy denies everyone else.

alter table cron_runs enable row level security;
