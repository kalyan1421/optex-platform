-- ─────────────────────────────────────────────────────────────────────────────
-- 0043_order_source.sql
--
-- SPEC-11 B-2: which channel an order was placed through.
--
-- CONTEXT
--   The mobile app's headline goal (G1) is "at least 35% of online orders placed
--   in-app within 90 days of GA", and its retention and repeat-purchase goals
--   (G4) compare app users with web-only users. None of that was measurable:
--   `orders` recorded nothing about where an order came from, and the only
--   client that has ever existed was the storefront. Without this column those
--   goals could only be estimated after the fact.
--
-- WHAT THIS ADDS
--   `orders.source`, one of `web`, `ios`, `android`, set by the API from the
--   `X-Optex-Client` request header at checkout.
--
--   `web` is the default and means "not identified as a mobile app", not "proven
--   to be the storefront". That is deliberate: the storefront has never sent the
--   header, so every historical order — and every order from a client that omits
--   or garbles it — is correctly `web` without a backfill, and the number that
--   matters (mobile) is exact because the app always sends it.
--
--   The value is attribution, not authorisation. The header is client-supplied,
--   so a determined caller can claim to be an app; the worst that buys them is a
--   skewed metric, and nothing in the API makes a decision on it.
--
-- WHY A CHECK, NOT AN ENUM
--   A new channel (a till, a partner integration) then needs a one-line
--   migration rather than `ALTER TYPE`, which cannot run inside a transaction
--   on older Postgres and cannot drop a value.
--
-- WHY NOT INSIDE `place_order`
--   The API stamps the column immediately after `place_order` returns. Folding
--   it into the function would mean re-issuing the checkout transaction — the
--   most critical function in the system, last rewritten in 0039 — to carry one
--   informational column. A failed stamp leaves the safe default (`web`), which
--   under-counts the app very slightly rather than corrupting an order.
--
-- READING IT
--   Share of paid orders placed in the app, last 30 days:
--     select round(100.0 * count(*) filter (where source <> 'web')
--                  / nullif(count(*), 0), 1) as app_share_pct
--     from   orders
--     where  payment_status = 'paid'
--       and  created_at >= now() - interval '30 days';
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

alter table orders
  add column if not exists source text not null default 'web';

alter table orders
  drop constraint if exists orders_source_check;

alter table orders
  add constraint orders_source_check check (source in ('web', 'ios', 'android'));

comment on column orders.source is
  'Channel the order was placed through: web | ios | android. Set by the API from X-Optex-Client at checkout; web means not identified as a mobile app (SPEC-11 B-2).';
