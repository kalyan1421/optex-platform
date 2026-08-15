-- 0015_branch_breaks.sql
--
-- Lunch / buffer breaks in appointment slot generation.
--
-- `AppointmentsService.generateSlots(open, close)` was a straight grid with
-- no concept of an excluded interval — missing code, not missing config.
-- `hours` already carries per-weekday windows the app reads as
-- `{mon:["09:00","18:00"], sun:null, ...}` (the live shape — see
-- `packages/db/src/queries/branches.ts` and `Backend/supabase/seed.sql`; the
-- `{open,close}` object shape in 0001's comment is stale). `breaks` mirrors
-- that shape exactly, so every RLS policy and admin-form pattern already
-- built for `hours` extends here with no new code beyond the column itself.
alter table public.branches add column breaks jsonb;

comment on column public.branches.breaks is
  'Per-weekday break window(s) to exclude from bookable slots, same shape as hours: {mon:["13:00","14:00"], sun:null, ...}. Null/absent means no break that day.';
