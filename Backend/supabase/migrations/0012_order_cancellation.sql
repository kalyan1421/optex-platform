-- 0012_order_cancellation.sql
--
-- Customer-requested order cancellation — the data model for SPEC-06.
--
-- The client decided the shape (CLIENT-ANSWERS B5): "customer cancel their own
-- order but that will be status need to confirmable in admin side with hour and
-- stages wise". So this is a request/approval workflow, deliberately NOT a
-- self-service status flip — Optex wants a human decision, because the answer
-- differs once frames have been picked.
--
-- Two things are created here:
--
--   app_settings                 the first slice of SPEC-05 (backend-owned
--                                config). SPEC-06 R2 requires the cancellation
--                                window and stage cut-off to be admin-set
--                                rather than constants, and nowhere existed to
--                                put them.
--
--   order_cancellation_requests  the request itself, its decision, and who made
--                                it. SPEC-06 R3 requires every decision to be
--                                attributable.
--
-- No refund machinery, deliberately. Client policy is "no refunds", and
-- SPEC-06 is explicit that a cancellation is not a refund — conflating them
-- creates an expectation the client has rejected. Approving a cancellation on a
-- paid order is a flag for manual handling (R5), never a provider call.

-- ─── app_settings ───────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb       not null,
  description text        not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users (id) on delete set null
);

comment on table public.app_settings is
  'Backend-owned configuration (SPEC-05). Values the business changes without a release.';

-- Defaults are OURS, not the client''s — CLIENT-ANSWERS O-4 is still open on the
-- exact thresholds. They live here precisely so that being wrong costs a minute
-- rather than a release. Seeded rather than left unset: SPEC-06 R2 requires an
-- unset value to fall back to a documented default, never to zero, which would
-- make every order ineligible.
insert into public.app_settings (key, value, description) values
  ('cancellation.window_hours', '24'::jsonb,
   'Hours after an order is placed during which a customer may request cancellation. SPEC-06 R2.'),
  ('cancellation.max_stage', '"processing"'::jsonb,
   'Latest fulfilment stage at which cancellation may still be requested. Orders past this are ineligible. SPEC-06 R2 default: not after dispatch.')
on conflict (key) do nothing;

-- ─── order_cancellation_requests ────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cancellation_status') then
    create type public.cancellation_status as enum ('pending', 'approved', 'declined');
  end if;
end
$$;

create table if not exists public.order_cancellation_requests (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid        not null references public.orders (id) on delete cascade,
  customer_id    uuid        not null references public.customers (id) on delete cascade,
  reason         text,
  status         public.cancellation_status not null default 'pending',
  -- The order's status when the request was made. An admin deciding tomorrow
  -- needs to know where the order was when the customer asked, not only where
  -- it is now — SPEC-06 flags an order that was dispatched while the request
  -- sat pending.
  status_at_request text      not null,
  decline_reason text,
  decided_by     uuid        references auth.users (id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- One open request per order. SPEC-06 R1: a second request must show the
-- pending state rather than create a duplicate, and a partial unique index is
-- what makes that a guarantee rather than a check the API might forget.
create unique index if not exists order_cancellation_requests_one_pending
  on public.order_cancellation_requests (order_id)
  where status = 'pending';

create index if not exists order_cancellation_requests_status_idx
  on public.order_cancellation_requests (status, created_at desc);

comment on table public.order_cancellation_requests is
  'Customer requests to cancel an order, and the admin decision. SPEC-06.';

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Same posture as 0009: reads are scoped, writes belong to the API via the
-- service role. No customer INSERT policy — a customer must not be able to
-- create a request that skips the eligibility rules the API enforces.
alter table public.app_settings enable row level security;
alter table public.order_cancellation_requests enable row level security;

drop policy if exists "admin reads settings" on public.app_settings;
create policy "admin reads settings"
  on public.app_settings for select
  using (public.is_super_admin());

drop policy if exists "customer reads own cancellation requests" on public.order_cancellation_requests;
create policy "customer reads own cancellation requests"
  on public.order_cancellation_requests for select
  using (customer_id = public.current_customer_id());

drop policy if exists "admin reads cancellation requests" on public.order_cancellation_requests;
create policy "admin reads cancellation requests"
  on public.order_cancellation_requests for select
  using (public.is_super_admin());
