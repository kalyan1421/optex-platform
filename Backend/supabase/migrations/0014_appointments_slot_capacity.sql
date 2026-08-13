-- 0014_appointments_slot_capacity.sql
--
-- SPEC-04 R1 — database-enforced slot capacity.
--
-- `AppointmentsService.assertSlotBookable()` is a SELECT-then-INSERT with
-- nothing behind it: it reads the taken slots, decides the requested one is
-- free, then inserts. Two concurrent requests for the same slot can both pass
-- the SELECT before either INSERT lands — the exact race a testing-strategy
-- pass surfaced (`appointments.e2e-spec.ts`, "allows exactly one of two
-- concurrent bookings"). For a 27-branch optician offering free eye tests as
-- the top-of-funnel offer, the failure is invisible in the software; it is
-- visible in the waiting room when two patients arrive for one optometrist.
--
-- This ships capacity = 1 (a partial unique index), matching CLIENT-ANSWERS'
-- decision on A6 ("capacity 1 per slot" is the shipped default, admin-editable
-- later per SPEC-04 R6/Phase 2 — not built here). Cancelled appointments are
-- excluded so a freed slot is bookable again, matching
-- `takenTimes()`'s `.neq('status', 'cancelled')` filter exactly.

create unique index if not exists appointments_one_per_slot
  on public.appointments (branch_id, scheduled_at)
  where status <> 'cancelled';
