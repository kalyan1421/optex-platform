-- 0013_cancellation_auto_decline.sql
--
-- SPEC-06 R9 (P1): auto-decline cancellation requests that sit unanswered too
-- long, so nothing is silently pending forever. A customer who asked to
-- cancel and never heard back has, in effect, been declined without a
-- reason — the exact failure mode R3/R4 exist to close for the admin-decided
-- path. This gives the same guarantee to the case where no admin acts at all.
--
-- Threshold is configuration (SPEC-05), same posture as 0012's
-- cancellation.window_hours / cancellation.max_stage: seeded rather than left
-- unset, so an unset value falls back to a documented default rather than to
-- zero (which here would auto-decline every request the instant it's made).
-- The number is ours, not the client's — CLIENT-ANSWERS O-4 is still open.

insert into public.app_settings (key, value, description) values
  ('cancellation.auto_decline_hours', '72'::jsonb,
   'Hours a cancellation request may sit pending before the system auto-declines it. SPEC-06 R9.')
on conflict (key) do nothing;
