-- ─────────────────────────────────────────────────────────────────────────────
-- 0022_reminder_flag_claim.sql
--
-- Closes audit finding F-04: appointment reminder SMS was not idempotent, and
-- the columns to make it idempotent had already shipped.
--
-- CONTEXT
--   Migration 0008 added `appointments.reminder_24h_sent` and
--   `reminder_1h_sent` for exactly this purpose, and its own closing notes list
--   "CronModule (reminder job) → filter on / set ... for idempotent sends" as
--   outstanding wiring. That wiring never happened. Eleven migrations later the
--   job's header still asserted that "the appointments table (migration 0001)
--   has NO reminder-tracking column" and recommended adding the very columns
--   sitting unused in the schema and in database.types.ts.
--
--   So the job approximated exactly-once delivery with a +/-7.5 minute window
--   tiled against a 15-minute cadence. That is a real technique, but it is only
--   as good as the assumption that runs never overlap and never go missing —
--   and a redeploy, a restart, an overrunning tick or clock skew each break it.
--   Overlap texts a customer twice; a gap drops their reminder permanently,
--   with no catch-up on the next run.
--
-- WHAT THIS ADDS
--   `claim_due_reminders(bucket, horizon, max)` — selects appointments that are
--   due, still remindable, and NOT yet flagged; marks them; and returns them,
--   all in ONE statement. `UPDATE ... WHERE flag = false ... RETURNING` is
--   atomic, so two concurrent runs cannot both claim the same row: the second
--   one's WHERE clause no longer matches.
--
--   That makes correctness a property of the database rather than of the
--   scheduler's timing, which in turn lets the job widen its window from
--   +/-7.5 minutes to "anything due within the horizon that we have not sent
--   yet" — so a missed run now self-heals on the next tick instead of silently
--   dropping the reminder.
--
-- CLAIM-BEFORE-SEND
--   The flag is set BEFORE the SMS goes out, which means a send that fails
--   after the claim is not retried. That is the deliberate direction to fail:
--   an un-sent reminder is a disappointment, a duplicated one at 3am is a
--   complaint. Delivery failures are recorded in `notification_log` (0023) and
--   are replayable from there.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

create or replace function claim_due_reminders(
  p_bucket  text,
  p_horizon interval,
  p_max     int default 200
)
RETURNS TABLE (
  id            uuid,
  scheduled_at  timestamptz,
  status        appt_status,
  contact_name  text,
  contact_phone text,
  customer_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_bucket NOT IN ('24h', '1h') THEN
    RAISE EXCEPTION 'Unknown reminder bucket: %', p_bucket;
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT a.id
    FROM   appointments a
    WHERE  a.status IN ('pending', 'confirmed', 'rescheduled')
      -- Due inside the horizon, and not already in the past. A run that was
      -- missed entirely still catches its appointments on the next tick.
      AND  a.scheduled_at > now()
      AND  a.scheduled_at <= now() + p_horizon
      AND  CASE p_bucket
             WHEN '24h' THEN a.reminder_24h_sent = false
             ELSE            a.reminder_1h_sent  = false
           END
    ORDER  BY a.scheduled_at
    LIMIT  p_max
    -- Skip rows another instance is mid-claim on rather than queueing behind
    -- them; they are that instance's to send.
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE appointments a
    SET    reminder_24h_sent = CASE WHEN p_bucket = '24h' THEN true ELSE a.reminder_24h_sent END,
           reminder_1h_sent  = CASE WHEN p_bucket = '1h'  THEN true ELSE a.reminder_1h_sent  END
    FROM   due
    WHERE  a.id = due.id
    RETURNING a.id, a.scheduled_at, a.status, a.contact_name, a.contact_phone, a.customer_id
  )
  SELECT c.id,
         c.scheduled_at,
         c.status,
         c.contact_name,
         c.contact_phone,
         cu.phone
  FROM   claimed c
  LEFT JOIN customers cu ON cu.id = c.customer_id
  ORDER  BY c.scheduled_at;
END;
$$;

comment on function claim_due_reminders(text, interval, int) is
  'Atomically claims and flags appointments due for a reminder bucket, returning them for sending. Two concurrent runs cannot claim the same row (F-04).';

-- Index supporting the claim predicate. Partial on the unsent flags, because
-- that is the only side of them the job ever queries and the table is
-- overwhelmingly rows that have already been reminded.
create index if not exists appointments_reminder_24h_due
  on appointments (scheduled_at)
  where reminder_24h_sent = false;

create index if not exists appointments_reminder_1h_due
  on appointments (scheduled_at)
  where reminder_1h_sent = false;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.claim_due_reminders(text, interval, int) from public;
revoke execute on function public.claim_due_reminders(text, interval, int) from anon;
revoke execute on function public.claim_due_reminders(text, interval, int) from authenticated;
grant  execute on function public.claim_due_reminders(text, interval, int) to service_role;
