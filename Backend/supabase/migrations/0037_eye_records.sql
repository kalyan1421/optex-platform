-- 0037_eye_records.sql
--
-- Structured home for the /eye-care intake form.
--
-- Background: the storefront's eye-care page collects a full clinical intake —
-- demographics, an eye/health history questionnaire, and a self-reported
-- spectacle prescription (SPH/CYL/AXIS/ADD/PD per eye). Until now it had
-- nowhere to go: the form books an `eye_test` appointment and every clinical
-- answer was flattened into `appointments.notes`, a 1000-character free-text
-- column. Nothing was queryable, typed, or reportable.
--
-- Why not reuse `prescriptions` (0001): that table is the *upload* pipeline —
-- `file_url` in the private prescriptions bucket, signed-URL downloads, and a
-- pending→processed review queue that the admin panel's Prescriptions screen
-- drives. Fileless, self-reported rows would sit in that queue with nothing to
-- download and nothing to verify. These are different artefacts: one is a
-- document the customer supplies, the other is what they typed about
-- themselves. They are kept apart deliberately.
--
-- Note the shape difference that made a straight reuse wrong anyway:
-- `prescriptions` has a single `pd` and no ADD columns, while the intake form
-- captures PD and ADD per eye.

create type eye_record_status as enum ('submitted', 'reviewed', 'archived');

create table eye_records (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,

  -- The appointment this intake was submitted alongside. Nullable and
  -- ON DELETE SET NULL: cancelling the visit must not destroy the clinical
  -- record, which is the thing with lasting value.
  appointment_id  uuid references appointments(id) on delete set null,

  -- Identity as given on the form. Deliberately denormalized rather than read
  -- through customer_id: the person being tested may not be the account holder
  -- (a parent booking for a child), and a record must keep the details that
  -- were true at submission even if the account is later edited.
  full_name       text not null,
  age             int check (age is null or age between 0 and 120),
  phone           text not null,
  email           text,
  gender          text,

  -- The "do any of these apply to you?" checklist, stored as the selected
  -- labels. An array rather than a column per condition so the questionnaire
  -- can gain options without a migration.
  conditions      text[] not null default '{}',
  history_notes   text,

  -- Self-reported prescription. Every column is nullable by design — the form
  -- says "leave blank if you'd rather we test fresh", and a blank record is a
  -- legitimate, common submission.
  --
  -- numeric(4,2) matches prescriptions.sphere_od/cyl_od (0001) so the two
  -- tables stay comparable when staff transcribe one into the other.
  sphere_od       numeric(4,2),
  sphere_os       numeric(4,2),
  cyl_od          numeric(4,2),
  cyl_os          numeric(4,2),
  axis_od         int check (axis_od is null or axis_od between 0 and 180),
  axis_os         int check (axis_os is null or axis_os between 0 and 180),
  add_od          numeric(4,2),
  add_os          numeric(4,2),
  pd_od           numeric(4,1),
  pd_os           numeric(4,1),

  status          eye_record_status not null default 'submitted',
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table eye_records is
  'Clinical intake submitted from the /eye-care form: demographics, eye/health history, and a self-reported prescription. Distinct from `prescriptions`, which is the uploaded-document pipeline with signed-URL downloads and its own review queue.';
comment on column eye_records.conditions is
  'Selected labels from the health-history checklist, e.g. {Diabetes,Glaucoma}. Array so new questionnaire options need no migration.';
comment on column eye_records.appointment_id is
  'The eye_test appointment booked alongside this intake. ON DELETE SET NULL — cancelling a visit must not delete the clinical record.';
comment on column eye_records.full_name is
  'Denormalized on purpose: the patient may not be the account holder, and the record must preserve the details given at submission time.';

-- A customer reading their own history, newest first.
create index eye_records_customer_idx on eye_records(customer_id, created_at desc);
-- The staff review queue: unreviewed submissions, oldest first.
create index eye_records_status_idx on eye_records(status, created_at) where status = 'submitted';
-- Pulling the intake up from an appointment detail screen.
create index eye_records_appointment_idx on eye_records(appointment_id) where appointment_id is not null;

alter table eye_records enable row level security;

-- Same posture as customer_notifications (0035), customer_addresses (0016) and
-- wishlist_items (0017): the customer may read their own rows; every write goes
-- through the API's service-role client with an explicit customer_id scope.
-- There is deliberately no customer-writable policy — a patient must not be
-- able to rewrite a submitted clinical record.
create policy "customer reads own eye records"
  on eye_records for select
  using (customer_id = current_customer_id() or is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Permissions (extends migration 0025's matrix, per 0026's precedent)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.permissions (id, description) values
  ('eye_records.read',  'View customer eye-care intake records and self-reported prescriptions.'),
  ('eye_records.write', 'Mark an eye record reviewed or archived.')
on conflict (id) do nothing;

-- Branch staff and managers run the eye-test clinic, so they read intake.
-- Write (marking reviewed) stays with the manager.
insert into public.role_permissions (role_id, permission_id) values
  ('branch_manager', 'eye_records.read'),
  ('branch_manager', 'eye_records.write'),
  ('branch_staff',   'eye_records.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'super_admin', id from public.permissions
where id in ('eye_records.read', 'eye_records.write')
on conflict do nothing;

-- Deliberately NOT granted to the `doctor` role. 0025 gives that role zero
-- permissions until the consultation module (SPEC-08 R5) ships, and this
-- migration does not reopen that decision — clinical intake is the obvious
-- long-term home for it, and R5 should grant it there rather than here.
