-- 0018_appointments_configurable_capacity.sql
--
-- SPEC-04 R6 — configurable capacity per slot, replacing the hardcoded 1.
--
-- Migration 0014 shipped capacity = 1 as a partial unique index on
-- (branch_id, scheduled_at) — a mechanism Postgres itself enforces
-- atomically, with no custom logic to get wrong. A unique index can only
-- express "at most one row with this key"; there is no plain Postgres
-- index type that expresses "at most N". Replacing it therefore means
-- replacing a proven, zero-custom-code guarantee with hand-written
-- trigger logic — a correctness-critical change to production booking
-- infrastructure, not a routine schema tweak. See the concurrency test
-- this ships with (`appointments.e2e-spec.ts`), which proves "exactly N
-- of M concurrent requests succeed" the same way 0014's own 5-way race
-- test proved "exactly 1 of 5" — that test is the actual guarantee this
-- comment can only describe.
--
-- THE CLASSIC BUG THIS AVOIDS: locking the existing rows at a slot (e.g.
-- `SELECT ... FOR UPDATE`) locks nothing when the slot is currently
-- empty — there is nothing to lock — which is exactly the moment two
-- concurrent first-bookings-of-a-slot need to be serialized. An advisory
-- lock keyed on the slot itself, taken unconditionally before the count
-- (not on the rows the count finds), closes that gap: the lock exists
-- independent of whether any row currently matches it.
set search_path = public;

alter table public.branches
  add column capacity int not null default 1 check (capacity > 0);

comment on column public.branches.capacity is
  'Max concurrent non-cancelled bookings per slot at this branch. Shipped default of 1 matches CLIENT-ANSWERS A6; admin-editable per SPEC-04 R6.';

drop index if exists appointments_one_per_slot;

create or replace function enforce_appointment_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  v_capacity int;
  v_count    int;
begin
  -- A cancelled row never consumes slot capacity — matches
  -- takenTimes()'s `.neq('status', 'cancelled')` filter exactly.
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  -- Serialize concurrent attempts at the same (branch, slot) before
  -- counting, so the count below is never computed against a moving
  -- target. Two independent hash keys (rather than one hashtext() over a
  -- concatenated string) to keep the false-collision probability low —
  -- a collision here only costs unrelated slots an unnecessary lock
  -- wait, never a correctness problem, since the count query itself is
  -- still scoped by the exact branch_id + scheduled_at match.
  perform pg_advisory_xact_lock(hashtext(NEW.branch_id::text), hashtext(NEW.scheduled_at::text));

  select capacity into v_capacity from public.branches where id = NEW.branch_id;

  -- Excluding NEW.id matters for UPDATE, not INSERT: a status-only change
  -- (e.g. pending -> confirmed) fires this trigger (status is in the
  -- column list below) without moving scheduled_at, so the row already
  -- counts itself among "existing bookings at this slot" unless excluded
  -- — without this, confirming a booking at an exactly-full slot would
  -- spuriously reject the row's own unrelated status transition.
  select count(*) into v_count
  from public.appointments
  where branch_id = NEW.branch_id
    and scheduled_at = NEW.scheduled_at
    and status <> 'cancelled'
    and id <> NEW.id;

  if v_count >= v_capacity then
    -- Plain message text, matched on in appointments.service.ts — not the
    -- default P0001 SQLSTATE alone, which any other bare RAISE EXCEPTION
    -- in this schema (place_order's several) would also raise, risking a
    -- false-positive catch if matched on code alone.
    raise exception 'appointment_slot_at_capacity';
  end if;

  return NEW;
end;
$$;

create trigger appointments_enforce_capacity
  before insert or update of scheduled_at, branch_id, status on public.appointments
  for each row
  execute function enforce_appointment_slot_capacity();
