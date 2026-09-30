-- ─────────────────────────────────────────────────────────────────────────────
-- 0042_payment_attempt_guard.sql
--
-- SPEC-11 B-7: nothing bounded concurrent payment attempts on one order.
--
-- CONTEXT
--   `PaymentsService.initiateMpesaStkPush` documented its own gap: "a second STK
--   attempt for the same order simply inserts a new pending row keyed by a new
--   CheckoutRequestID". Pesapal's `initiate` likewise opened a second hosted
--   session and overwrote `orders.pesapal_id`. Audit A-03 bounded the SPREAD of
--   destination numbers and a throttle bounds the RATE, but nothing bounded
--   CONCURRENCY.
--
--   That matters because M-Pesa is a push. If a customer's first prompt is
--   still open on the handset when a second arrives (a double tap, a retry after
--   a client-side timeout, the app and the storefront open at once, or a switch
--   from M-Pesa to card mid-prompt) and they approve both, Safaricom debits
--   twice. `creditOrder` is idempotent so the order is credited once, and the
--   surplus sits matched-but-unapplied until an admin reconciles it. The money
--   is real; the order is not.
--
-- WHY A CLAIM, NOT A CHECK
--   The obvious guard is "look for a pending row, refuse if one exists". It does
--   not work, because the pending row is only written AFTER the provider
--   answers. Two requests arriving together both look, both find nothing, and
--   both call the provider — the check and the write are separated by a network
--   round trip.
--
--   So the guard reserves the order BEFORE the provider call. `claim_payment_
--   attempt` returns true to one caller and describes the winner to everyone
--   else; the API releases the claim once the attempt is recorded (the recorded
--   `pending` row then carries the guard) or once the provider has definitively
--   refused (nothing reached a handset).
--
-- THE TWO THINGS IT CHECKS, IN THIS ORDER
--   (a) a CLAIM inside the window     — an attempt is in flight: the API has
--                                       reserved the order and has not yet
--                                       recorded a row.
--   (b) a PENDING ROW inside the window on EITHER rail — an attempt was
--                                       recorded and has not resolved.
--
--   The order is load-bearing. The API records the row and THEN releases the
--   claim. A claimer that read (b) first could see no row, lose the race to the
--   winner's record-and-release, then read (a) and see no claim either — and
--   walk through both. Reading the claim first closes that: if it has already
--   been released, the row it was released after is visible to the very next
--   statement (READ COMMITTED takes a fresh snapshot per statement, which
--   plpgsql does for a VOLATILE function).
--
--   A row that has resolved (`matched`, `failed`, `reversed`) no longer blocks:
--   an attempt that failed at second 8 lets the customer retry or switch method
--   immediately rather than waiting out the window.
--
-- THE WINDOW
--   One number covers both checks. 90 seconds is the STK prompt's useful life
--   (Safaricom stops honouring a prompt roughly a minute after it is sent) plus
--   margin. It must also outlast a provider call from claim to release — the
--   API bounds those with explicit timeouts, and a unit test asserts the
--   inequality — otherwise a slow call could outlive its own claim.
--
--   A claim that is never released (the process died mid-call) simply expires.
--
-- WHY A TRANSACTION LOCK
--   Same reasoning as 0021: a session-scoped advisory lock is unsafe over
--   PostgREST's connection pool. `pg_advisory_xact_lock` is released when this
--   function's own transaction ends, which is exactly the read-modify-write
--   that needs protecting. Contention is per order — different orders hash
--   elsewhere and never queue behind each other.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── Claim table ─────────────────────────────────────────────────────────────
--
-- At most one row per order, overwritten by the next claim once it expires and
-- deleted on release, so it stays close to empty. Cascades with the order.

create table if not exists payment_attempt_claims (
  order_id    uuid primary key references orders(id) on delete cascade,
  claimed_at  timestamptz not null default now()
);

comment on table payment_attempt_claims is
  'Reserves an order for one in-flight payment attempt between the provider call and the pending row being recorded (SPEC-11 B-7). Written only by claim_payment_attempt.';

-- Operational bookkeeping, service-role only: enabling RLS with no policy denies
-- everyone else, exactly as for cron_runs (0021).
alter table payment_attempt_claims enable row level security;

-- ─── Claim ───────────────────────────────────────────────────────────────────
--
-- Returns one of
--   { "claimed": true }
--   { "claimed": false, "reason": "in_flight",    "retry_after_seconds": n }
--   { "claimed": false, "reason": "live_attempt", "provider": "mpesa"|"pesapal",
--     "ref": "...", "phone": "2547..."|null, "raw": {...}, "retry_after_seconds": n }
--
-- `live_attempt` carries the existing attempt's reference and raw payload so the
-- API can answer an identical retry with the SAME CheckoutRequestID or redirect
-- URL instead of pushing again.

create or replace function claim_payment_attempt(
  p_order_id        uuid,
  p_window_seconds  int default 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_window      interval;
  v_claimed_at  timestamptz;
  v_live        record;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'p_window_seconds must be a positive number of seconds';
  END IF;
  v_window := make_interval(secs => p_window_seconds);

  -- Serialise claims for THIS order only.
  PERFORM pg_advisory_xact_lock(hashtext('payment_attempt:' || p_order_id::text));

  -- (a) An attempt reserved the order and has not recorded a row yet.
  --     Read BEFORE (b) — see the header.
  SELECT c.claimed_at INTO v_claimed_at
  FROM   payment_attempt_claims c
  WHERE  c.order_id = p_order_id;

  IF v_claimed_at IS NOT NULL AND v_claimed_at > clock_timestamp() - v_window THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'in_flight',
      'retry_after_seconds',
        greatest(1, ceil(extract(epoch FROM (v_claimed_at + v_window - clock_timestamp())))::int)
    );
  END IF;

  -- (b) A recorded attempt, on either rail, that has not resolved yet.
  SELECT t.provider, t.ref, t.phone, t.raw, t.started_at
  INTO   v_live
  FROM (
    SELECT 'mpesa'::text        AS provider,
           m.mpesa_ref          AS ref,
           m.customer_phone     AS phone,
           m.raw                AS raw,
           m.received_at        AS started_at
    FROM   mpesa_transactions m
    WHERE  m.order_id = p_order_id
      AND  m.status = 'pending'
      AND  m.received_at > clock_timestamp() - v_window

    UNION ALL

    SELECT 'pesapal'::text      AS provider,
           p.pesapal_order_id   AS ref,
           NULL::text           AS phone,
           p.raw                AS raw,
           p.received_at        AS started_at
    FROM   pesapal_transactions p
    WHERE  p.order_id = p_order_id
      AND  p.status = 'pending'
      AND  p.received_at > clock_timestamp() - v_window
  ) t
  ORDER  BY t.started_at DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'reason', 'live_attempt',
      'provider', v_live.provider,
      'ref', v_live.ref,
      'phone', v_live.phone,
      'raw', v_live.raw,
      'retry_after_seconds',
        greatest(1, ceil(extract(epoch FROM (v_live.started_at + v_window - clock_timestamp())))::int)
    );
  END IF;

  -- Free: reserve it. An expired claim is overwritten rather than accumulated.
  INSERT INTO payment_attempt_claims (order_id, claimed_at)
  VALUES (p_order_id, clock_timestamp())
  ON CONFLICT (order_id) DO UPDATE
    SET claimed_at = excluded.claimed_at;

  RETURN jsonb_build_object('claimed', true);
END;
$$;

comment on function claim_payment_attempt(uuid, int) is
  'Atomically reserves an order for one payment attempt, or describes the attempt that already holds it. Closes the concurrent-STK double-debit window (SPEC-11 B-7).';

-- ─── Release ─────────────────────────────────────────────────────────────────
--
-- Called after the attempt is recorded, or after the provider has definitively
-- refused. Deliberately NOT called when the outcome is ambiguous (a timeout, a
-- dropped connection): an STK push may have reached the handset even though we
-- never heard back, and the claim expiring on its own is what keeps the order
-- closed to a second prompt while that is possible.

create or replace function release_payment_attempt(p_order_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM payment_attempt_claims WHERE order_id = p_order_id;
$$;

comment on function release_payment_attempt(uuid) is
  'Releases the claim taken by claim_payment_attempt. Idempotent (SPEC-11 B-7).';

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Same posture as 0010 / 0021: the API calls these with the service-role key and
-- nothing else has any business reserving or releasing a payment attempt. A
-- customer able to call `claim_payment_attempt` could lock another customer out
-- of paying for their own order.

revoke execute on function public.claim_payment_attempt(uuid, int) from public;
revoke execute on function public.claim_payment_attempt(uuid, int) from anon;
revoke execute on function public.claim_payment_attempt(uuid, int) from authenticated;
grant  execute on function public.claim_payment_attempt(uuid, int) to service_role;

revoke execute on function public.release_payment_attempt(uuid) from public;
revoke execute on function public.release_payment_attempt(uuid) from anon;
revoke execute on function public.release_payment_attempt(uuid) from authenticated;
grant  execute on function public.release_payment_attempt(uuid) to service_role;
