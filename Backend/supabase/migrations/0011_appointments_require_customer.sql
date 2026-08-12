-- 0011_appointments_require_customer.sql
--
-- Make the schema agree with the policy: an appointment belongs to a customer.
--
-- `POST /api/appointments` has always required a bearer token and derives the
-- customer from the JWT — an anonymous caller gets a 401. But
-- `appointments.customer_id` stayed nullable from 0001, when guest booking was
-- still on the table, so the database would happily accept a booking with no
-- owner. Nothing can create one through the API today; this closes the gap
-- between what the API enforces and what the table permits, which is the same
-- shape of gap 0009 closed for direct writes.
--
-- A NULL customer_id is not just untidy. Every customer-facing appointment
-- read is scoped by `customer_id = <caller>`, so an ownerless row is invisible
-- to the person who booked it and cannot be cancelled or rescheduled by them.
--
-- ON EXISTING DATA
--
-- This deliberately refuses to run rather than guessing. There is no way to
-- infer who a NULL-owner booking belongs to — contact_name/contact_phone are
-- free text and not linked to `customers` — so the choice between matching
-- them up by hand and cancelling them is a business decision about real
-- appointments with real people expecting to be seen. A migration should not
-- make that call silently, and it should certainly not DELETE bookings.
--
-- If this raises, resolve the rows first:
--
--   select id, contact_name, contact_phone, scheduled_at, status
--     from appointments where customer_id is null order by scheduled_at;
--
-- then either attach each to a customer, or cancel and delete them, and
-- re-run. Local and CI databases have none, so this is a no-op there.

do $$
declare
  orphan_count int;
begin
  select count(*) into orphan_count from public.appointments where customer_id is null;

  if orphan_count > 0 then
    raise exception
      'Cannot enforce appointments.customer_id NOT NULL: % ownerless booking(s) exist. '
      'Attach each to a customer or cancel them, then re-run this migration. '
      'See the comment at the top of 0011_appointments_require_customer.sql.',
      orphan_count;
  end if;
end
$$;

alter table public.appointments
  alter column customer_id set not null;

-- The guest contact columns stay. They are unused today — the booking form
-- folds that text into `notes` — but a customer booking on behalf of a family
-- member is a real case, and dropping columns is not reversible. Removing them
-- is a separate decision from requiring an owner.
comment on column public.appointments.contact_name is
  'Optional contact for the appointment, e.g. when booking for a family member. The booking itself is always owned by customer_id.';
comment on column public.appointments.contact_phone is
  'Optional contact phone for the appointment. See contact_name.';
