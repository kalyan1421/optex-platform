-- ─────────────────────────────────────────────────────────────────────────────
-- 0044_push_devices.sql
--
-- SPEC-11 B-1: push notification infrastructure.
--
-- CONTEXT
--   The mobile app (SPEC-11) mints an FCM token, but there was nowhere to put
--   it and nothing to send to it: no device-token table, no register route, no
--   sender. The whole client half — permission, token rotation, foreground
--   display, tap-to-deep-link, per-category muting — was finished and pointed at
--   a stub that logged instead of calling anything.
--
-- WHAT THIS ADDS
--
--   1. `device_tokens` — one row per handset that has agreed to receive push.
--
--      A token identifies a DEVICE, not a customer, so `token` is unique and
--      registering an existing token MOVES it to the caller. That is the shared-
--      handset case: customer A signs out without the deregister call landing
--      (offline, killed app), customer B signs in on the same phone and
--      registers — the row must become B's, or A's order updates keep arriving
--      on a phone A no longer holds.
--
--      The per-category opt-out lives on the row (`muted_categories`) because
--      that is where the client keeps it: a device-local preference sent along
--      with the token. It is honoured HERE, at send time — a muted category is
--      never sent — rather than merely hidden by the app, which is what "honoured
--      server-side" (P0-10) means. The in-app notification centre is unaffected:
--      someone who silenced offer pushes has not asked for their offer history to
--      vanish.
--
--      `disabled_at` is set when FCM reports a token dead (the app was
--      uninstalled, or the user cleared its data). A disabled row is kept, not
--      deleted, so a later successful registration of the same token revives it
--      rather than colliding on the unique key.
--
--   2. `'push'` on `notification_channel`, so push attempts are recorded in
--      `notification_log` beside SMS and email. That is what makes "share of
--      reminders delivered by push" (G3) and the Africa's Talking spend
--      reduction measurable, and it is the only way to answer "was the customer
--      actually told?" for a customer whose reminder went out as a push.
--
--      Push rows are written straight to a TERMINAL status (`sent` or
--      `abandoned`). They are never `pending` or `failed`, so the retry sweep —
--      which re-sends anything in those two states as SMS or email — can never
--      pick one up. Retrying a reminder half an hour late is worse than the SMS
--      that goes out alongside it, so a push is deliberately fire-once.
--
-- SERVICE-ROLE ONLY
--   Tokens are credentials-lite: with the sender's own credentials a token lets
--   you notify a device. RLS is enabled with no policy, so nothing but the API's
--   service-role client can read or write them — the same posture as
--   `notification_log` (0023) and `cron_runs` (0021).
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── Channel ─────────────────────────────────────────────────────────────────
--
-- IF NOT EXISTS makes this safe to re-run. The new value is not used anywhere in
-- this file: Postgres forbids using an enum value in the transaction that added
-- it.

alter type notification_channel add value if not exists 'push';

-- ─── Device tokens ───────────────────────────────────────────────────────────

create table if not exists device_tokens (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id) on delete cascade,
  token            text not null,
  platform         text not null,
  app_version      text,
  -- Categories this DEVICE has opted out of. Subset of `customer_notifications`'
  -- categories; enforced here so a typo cannot silently mute nothing.
  muted_categories text[] not null default '{}',
  created_at       timestamptz not null default now(),
  -- Bumped on every registration. The app re-registers at start-up whenever it
  -- holds consent, so this is what tells a live device from a stale row.
  last_seen_at     timestamptz not null default now(),
  -- Set when FCM says the token is no longer valid. Never cleared by a send.
  disabled_at      timestamptz,

  constraint device_tokens_token_key unique (token),
  constraint device_tokens_platform_check check (platform in ('ios', 'android')),
  constraint device_tokens_muted_check
    check (muted_categories <@ array['order', 'appointment', 'offer']::text[])
);

comment on table device_tokens is
  'FCM registration tokens, one per handset that has agreed to push. A token identifies a device, so registering an existing one moves it to the caller (shared handsets). Service-role only (SPEC-11 B-1).';

comment on column device_tokens.muted_categories is
  'Categories this device has opted out of. Honoured at send time, server-side (SPEC-11 P0-10).';

comment on column device_tokens.disabled_at is
  'Set when FCM reports the token dead. Kept rather than deleted so a later registration revives the row.';

-- The send path: "this customer's live devices".
create index if not exists device_tokens_customer_active
  on device_tokens (customer_id)
  where disabled_at is null;

-- The broadcast path pages through every live device in a stable order.
create index if not exists device_tokens_active_id
  on device_tokens (id)
  where disabled_at is null;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table device_tokens enable row level security;
