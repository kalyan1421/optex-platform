-- 0019_customer_deactivation.sql
--
-- Admin "Deactivate customer" action (MISSING_FEATURES A-5) — previously a
-- disabled menu item with no backend behind it at all.
--
-- `deactivated_at` mirrors the `prescriptions.processed_at` pattern already
-- used in this schema: a nullable timestamp stamped on deactivate and
-- cleared on reactivate, rather than a separate boolean that could drift
-- from it. Soft-deactivate only, never a delete — `orders.customer_id`
-- references this row, so removing it would break order history.
set search_path = public;

alter table public.customers
  add column deactivated_at timestamptz;

comment on column public.customers.deactivated_at is
  'Set by an admin deactivating this customer, cleared on reactivation. NULL = active. The customers row is never deleted (orders reference it); the linked auth.users row is also banned/unbanned in lockstep via the Supabase Admin API so a deactivated customer cannot sign in.';
