-- 0036_reminder_claim_customer_id.sql
--
-- `claim_due_reminders` (0022) already joins `customers` for the phone
-- number but never returned `customer_id`, so the reminder job has no way
-- to write a matching row into `customer_notifications` (0035) alongside
-- the SMS it already sends. Adds the column.
--
-- `CREATE OR REPLACE FUNCTION` cannot change a function's return columns,
-- so this drops and recreates it — same signature, same body, same grants,
-- one extra output column. Not a behavioural change to the claim/send logic
-- itself, which is otherwise untouched.

set search_path = public;

drop function if exists claim_due_reminders(text, interval, int);

create function claim_due_reminders(
  p_bucket  text,
  p_horizon interval,
  p_max     int default 200
)
RETURNS TABLE (
  id             uuid,
  scheduled_at   timestamptz,
  status         appt_status,
  contact_name   text,
  contact_phone  text,
  customer_phone text,
  customer_id    uuid
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
      AND  a.scheduled_at > now()
      AND  a.scheduled_at <= now() + p_horizon
      AND  CASE p_bucket
             WHEN '24h' THEN a.reminder_24h_sent = false
             ELSE            a.reminder_1h_sent  = false
           END
    ORDER  BY a.scheduled_at
    LIMIT  p_max
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
         cu.phone,
         c.customer_id
  FROM   claimed c
  LEFT JOIN customers cu ON cu.id = c.customer_id
  ORDER  BY c.scheduled_at;
END;
$$;

comment on function claim_due_reminders(text, interval, int) is
  'Atomically claims and flags appointments due for a reminder bucket, returning them for sending. Two concurrent runs cannot claim the same row (F-04).';

revoke execute on function public.claim_due_reminders(text, interval, int) from public;
revoke execute on function public.claim_due_reminders(text, interval, int) from anon;
revoke execute on function public.claim_due_reminders(text, interval, int) from authenticated;
grant  execute on function public.claim_due_reminders(text, interval, int) to service_role;
