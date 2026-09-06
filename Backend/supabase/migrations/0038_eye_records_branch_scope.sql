-- 0038_eye_records_branch_scope.sql
--
-- Branch-scopes the eye-record review queue (0037).
--
-- 0037 shipped `/admin/eye-records` unscoped: any holder of `eye_records.read`
-- saw every branch's intake. Its own controller docblock flagged this and
-- deferred the decision, on the grounds that `eye_records` had no branch of its
-- own and reached one only through a nullable `appointment_id`.
--
-- The decision, made here: denormalize the branch onto the record.
--
-- Why not just join through `appointment_id` at query time — the cheaper-looking
-- option? Because that join does not survive its own foreign key. 0037 made
-- `appointment_id` ON DELETE SET NULL specifically so that cancelling a visit
-- would not destroy the clinical record; a record whose branch is only ever
-- derived from that column silently loses its branch — and so disappears from
-- every branch-scoped queue — the moment the appointment is deleted. A stored
-- `branch_id` records where the intake was actually taken, which is a fact
-- about the past that no later deletion should be able to rewrite. It is the
-- same reason 0037 denormalizes `full_name` and `audit_log` denormalizes the
-- actor's role.
--
-- The value is always derived SERVER-SIDE from the appointment the API has
-- already verified the caller owns — never from a client-supplied branch id,
-- matching the rule the three existing scoped surfaces follow.

alter table eye_records
  add column branch_id uuid references branches(id);

comment on column eye_records.branch_id is
  'Branch the intake was taken at, copied from the linked appointment at insert. Denormalized rather than joined through appointment_id because that column is ON DELETE SET NULL — a derived branch would vanish when a visit is cancelled, dropping the record out of every branch queue. Server-derived only; never client-supplied.';

-- The branch review queue: one branch's unreviewed intake, oldest first.
create index eye_records_branch_idx on eye_records(branch_id, created_at desc);

-- Backfill the records 0037 already stored, from the appointment each points at.
update eye_records er
set    branch_id = a.branch_id
from   appointments a
where  a.id = er.appointment_id
  and  er.branch_id is null;
