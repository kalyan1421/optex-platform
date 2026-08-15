-- ─────────────────────────────────────────────────────────────────────────────
-- 0023_notification_log.sql
--
-- Closes audit finding F-06: SMS and email failures were logged to stdout and
-- then dropped forever.
--
-- CONTEXT
--   Both notification services wrapped their send in a try/catch, logged, and
--   returned `{ ok: false }`. No retry, no backoff, no dead letter, and no
--   record that the attempt ever happened. A brief Africa's Talking or Resend
--   outage silently lost every order confirmation, status change and
--   appointment reminder sent during it, and nobody found out until a customer
--   called.
--
--   In this market SMS is the primary channel, not a convenience — so "we think
--   we sent it" is not a good enough answer, and there was no way to produce a
--   better one after the fact.
--
-- WHAT THIS ADDS
--   A durable record of every send attempt, which buys three things the
--   platform could not previously do:
--
--     1. REPLAY. Failed rows are retried by the cron sweep with exponential
--        backoff, so a provider blip self-heals instead of losing messages.
--     2. AUDIT. "Did the customer get told?" becomes a query rather than a
--        guess — including for appointment reminders, where 0022 deliberately
--        flags before sending and this log is what makes that safe.
--     3. VISIBILITY. Rows stuck in `failed` past their retry budget are the
--        operational signal that a provider is down.
--
-- DEDUPLICATION
--   `dedupe_key` is a caller-supplied idempotency key with a partial unique
--   index over non-terminal rows. It lets a caller say "the confirmation for
--   order X" once; a second attempt to enqueue the same thing conflicts rather
--   than queuing a duplicate. Deliberately partial so that a genuinely new
--   send for the same subject later on is still permitted.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type notification_channel as enum ('sms', 'email');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type notification_status as enum ('pending', 'sent', 'failed', 'abandoned');
  end if;
end$$;

create table if not exists notification_log (
  id           uuid primary key default gen_random_uuid(),
  channel      notification_channel not null,
  recipient    text not null,
  subject      text,
  body         text not null,
  status       notification_status not null default 'pending',
  attempts     int not null default 0,
  last_error   text,
  -- Idempotency key from the caller, e.g. 'order-confirmation:<order_id>'.
  dedupe_key   text,
  -- Earliest the retry sweep may pick this row up again (exponential backoff).
  next_retry_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  sent_at      timestamptz
);

comment on table notification_log is
  'Durable record of every SMS/email send attempt, enabling replay of provider outages and answering "was the customer actually told?" (F-06).';

-- Retry sweep predicate: unfinished rows whose backoff has elapsed.
create index if not exists notification_log_retry
  on notification_log (next_retry_at)
  where status in ('pending', 'failed');

-- Operational view: what is currently broken.
create index if not exists notification_log_status_created
  on notification_log (status, created_at desc);

-- One live row per logical message. Terminal rows are excluded so a later,
-- genuinely new send for the same subject is still allowed.
create unique index if not exists notification_log_dedupe
  on notification_log (dedupe_key)
  where dedupe_key is not null and status in ('pending', 'failed');

-- ─── updated_at maintenance ──────────────────────────────────────────────────

create or replace function touch_notification_log()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists notification_log_touch on notification_log;
create trigger notification_log_touch
  before update on notification_log
  for each row
  execute function touch_notification_log();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Message bodies contain customer names, order numbers and appointment times.
-- The service-role client bypasses RLS; enabling it with no policy denies
-- everyone else, including any future anon-key path.

alter table notification_log enable row level security;
