-- ─────────────────────────────────────────────────────────────────────────────
-- 0025_rbac_foundation.sql
--
-- CR-01 Phase 1B, R1 (RBAC) — SPEC-08. The foundational piece the rest of
-- Phase 1B (inventory ledger, product analytics, branch P&L, doctor
-- consultation) reads from.
--
-- CONTEXT
--   Today there is exactly one role: `super_admin`, checked identically in
--   three places (`is_super_admin()` below, `apps/admin/middleware.ts`,
--   `apps/api/src/auth/roles.guard.ts`). This migration expands that to 7
--   roles — Super Admin, Branch Manager, Branch Staff, Inventory Manager,
--   Accountant, Marketing, Doctor — with per-role permissions and branch
--   scoping for the two branch-scoped roles.
--
-- WHY FIVE TABLES, NOT AN ENUM
--   `role_permissions` is a genuine many-to-many relation (roles.md), not
--   per-row metadata — a real join table keeps referential integrity against
--   `permissions` (a typo'd permission string becomes a broken FK, not a
--   silent no-op) and matches this schema's existing preference for join
--   tables over enums wherever the relationship evolves (`inventory`'s
--   (product_id, branch_id), `wishlist_items`). SPEC-08's own acceptance
--   criterion — "adding a role does not require a deploy" — extends to
--   permissions too: R2 will add new permission strings (e.g.
--   `inventory.transfer`), and those additions must not require a deploy
--   either, which a Postgres enum cannot offer (ADD VALUE can't run inside a
--   transaction with other DDL, and enum values can't be removed).
--
-- WHY NO NEW RLS FUNCTIONS
--   `apps/admin` never queries Postgres directly — every read/write goes
--   through the NestJS API, which always uses the service-role client and so
--   always bypasses RLS regardless of what policies exist. `current_customer_id()`
--   (migration 0006) earns its keep because `apps/web` genuinely does query
--   Postgres directly with the anon key for customer-facing SSR reads; there is
--   no equivalent direct-read path for staff. Branch-aware SQL helper functions
--   here would be dead code that never executes — see migration 0009's own
--   stated philosophy: "RLS stops being the enforcement layer... and becomes
--   defence-in-depth" for admin-owned tables. All 5 tables below get RLS
--   enabled with ZERO policies (service-role only), matching that pattern
--   exactly. The real enforcement is the NestJS `PermissionsGuard` (application
--   code, this migration's companion PR).
--
-- WHAT'S DELIBERATELY NOT HERE
--   Branch scoping for `orders`/`appointments`/`inventory` (the API-layer
--   retrofit is a separate, sequenced change — SPEC-08 R1 sub-phase 1b).
--   Dashboard/analytics branch attribution (explicitly R4's job — no branch
--   attribution rule exists yet, and inventing one here would be scope creep
--   into "branch P&L"). An audit_log retention/purge job ("3 months minimum"
--   is a floor, not a TTL — nothing here deletes rows).
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── roles ───────────────────────────────────────────────────────────────────
-- Text primary key (not a UUID) — the 7 values are stable, human-readable
-- identifiers used directly in code (`@RequirePermission`, `app_metadata.role`)
-- and are far more debuggable as 'branch_manager' than as an opaque UUID.

create table if not exists public.roles (
  id              text primary key,
  name            text not null,
  description     text not null,
  is_branch_scoped boolean not null default false,
  requires_mfa    boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.roles is
  'The 7 staff roles (SPEC-08 R1). Data, not code — a new role is a row, not a deploy.';
comment on column public.roles.is_branch_scoped is
  'True for Branch Manager and Branch Staff only. Drives whether a staff_users.branch_id assignment is required and meaningful.';
comment on column public.roles.requires_mfa is
  'True for Super Admin only in this phase (SPEC-08: "2FA | Super Admin"). A column, not a hardcoded check, so extending MFA to another role later is a data change.';

insert into public.roles (id, name, description, is_branch_scoped, requires_mfa) values
  ('super_admin',       'Super Admin',       'Full access across every branch. Requires 2FA.', false, true),
  ('branch_manager',    'Branch Manager',    'Manages one branch: its orders, appointments, inventory, customers and staff-level actions.', true,  false),
  ('branch_staff',      'Branch Staff',      'Narrower than Branch Manager — day-to-day order and appointment handling for one branch.', true,  false),
  ('inventory_manager', 'Inventory Manager', 'Cross-branch inventory oversight. Does not manage orders or customers.', false, false),
  ('accountant',        'Accountant',        'Financial visibility — dashboard, analytics, payments reconciliation. No order/customer mutation.', false, false),
  ('marketing',         'Marketing',         'Product catalogue visibility, promotions and review moderation.', false, false),
  ('doctor',            'Doctor',            'Reserved for the consultation module (SPEC-08 R5), which is separately blocked. Intentionally granted zero permissions until that module ships.', false, false)
on conflict (id) do nothing;

-- ─── permissions ─────────────────────────────────────────────────────────────
-- 25 permissions, each grounded in an actual route inventoried against the
-- live controllers, or an explicitly-required new module (staff, audit log).
-- `resource.action` naming, consistently `.read`/`.write` where a route pair
-- exists, so a future read-only viewer role doesn't require a new permission
-- shape.

create table if not exists public.permissions (
  id          text primary key,
  description text not null,
  created_at  timestamptz not null default now()
);

comment on table public.permissions is
  'The permission vocabulary routes declare via @RequirePermission(). New permissions (e.g. R2''s inventory.transfer) are added here, not in a deploy.';

insert into public.permissions (id, description) values
  ('dashboard.read',        'View the admin dashboard KPIs.'),
  ('analytics.read',        'View the analytics/reporting page.'),
  ('products.read',         'View the product catalogue in the admin panel.'),
  ('products.write',        'Create, edit, deactivate products; upload product images.'),
  ('orders.read',           'View orders.'),
  ('orders.write',          'Update order fulfilment status.'),
  ('orders.cancel',         'Admin-initiated order cancellation (not a customer request decision).'),
  ('cancellations.decide',  'Approve or decline a customer-requested order cancellation.'),
  ('customers.read',        'View the customer list and detail.'),
  ('customers.write',       'Deactivate/reactivate a customer account.'),
  ('appointments.read',     'View appointments.'),
  ('appointments.write',    'Update or reschedule appointments.'),
  ('inventory.read',        'View stock levels.'),
  ('inventory.write',       'Set stock levels. Transitional — R2 replaces the editable grid with an append-only ledger; this grant will be revisited then.'),
  ('reviews.moderate',      'Approve, flag or reply to product reviews.'),
  ('promotions.read',       'View promo codes and banners.'),
  ('promotions.write',      'Create, edit or remove promo codes and banners.'),
  ('branches.read',         'View the branch directory.'),
  ('branches.write',        'Create, edit or remove branches.'),
  ('payments.read',         'View payment transactions.'),
  ('payments.reconcile',    'Manually reconcile or link a payment transaction to an order.'),
  ('prescriptions.read',    'View and download customer prescription files.'),
  ('prescriptions.write',   'Mark a prescription processed/pending.'),
  ('staff.manage',          'Create, edit, deactivate staff accounts and assign roles/branches.'),
  ('audit_log.read',        'View the audit log.')
on conflict (id) do nothing;

-- ─── role_permissions ────────────────────────────────────────────────────────
-- THE permission matrix. Composite PK, no surrogate id — this is a pure
-- membership relation, same shape as wishlist_items' (customer_id, product_id).

create table if not exists public.role_permissions (
  role_id       text not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is
  'The permission matrix. Editable as data — granting or revoking a permission is an UPDATE, not a deploy.';

-- Super Admin: everything.
insert into public.role_permissions (role_id, permission_id)
select 'super_admin', id from public.permissions
on conflict do nothing;

-- Branch Manager: their branch's orders/appointments/inventory/customers, plus
-- cancellation decisions and admin-initiated cancels for their own orders.
-- No dashboard/analytics (no branch attribution rule exists yet — R4's job),
-- no payments/prescriptions (neither table has a branch_id column, and
-- prescriptions are health data — see the migration header).
insert into public.role_permissions (role_id, permission_id) values
  ('branch_manager', 'products.read'),
  ('branch_manager', 'orders.read'),
  ('branch_manager', 'orders.write'),
  ('branch_manager', 'orders.cancel'),
  ('branch_manager', 'cancellations.decide'),
  ('branch_manager', 'customers.read'),
  ('branch_manager', 'appointments.read'),
  ('branch_manager', 'appointments.write'),
  ('branch_manager', 'inventory.read'),
  ('branch_manager', 'inventory.write')
on conflict do nothing;

-- Branch Staff: narrower than Branch Manager — no cancellation authority, no
-- customer deactivation, no inventory writes.
insert into public.role_permissions (role_id, permission_id) values
  ('branch_staff', 'products.read'),
  ('branch_staff', 'orders.read'),
  ('branch_staff', 'orders.write'),
  ('branch_staff', 'customers.read'),
  ('branch_staff', 'appointments.read'),
  ('branch_staff', 'appointments.write')
on conflict do nothing;

-- Inventory Manager: cross-branch stock oversight. Sees the branch directory
-- (needed for cross-branch stock ops) and the catalogue, nothing customer- or
-- order-facing.
insert into public.role_permissions (role_id, permission_id) values
  ('inventory_manager', 'products.read'),
  ('inventory_manager', 'inventory.read'),
  ('inventory_manager', 'inventory.write'),
  ('inventory_manager', 'branches.read')
on conflict do nothing;

-- Accountant: financial visibility. Dashboard/analytics, payments (including
-- reconcile — SPEC-08's own user story), no order/customer mutation.
insert into public.role_permissions (role_id, permission_id) values
  ('accountant', 'dashboard.read'),
  ('accountant', 'analytics.read'),
  ('accountant', 'payments.read'),
  ('accountant', 'payments.reconcile')
on conflict do nothing;

-- Marketing: catalogue visibility, promotions, review moderation.
insert into public.role_permissions (role_id, permission_id) values
  ('marketing', 'products.read'),
  ('marketing', 'promotions.read'),
  ('marketing', 'promotions.write'),
  ('marketing', 'reviews.moderate')
on conflict do nothing;

-- Doctor: deliberately zero rows. The role exists (satisfies R1's literal
-- requirement); it grants nothing because the consultation module (R5) is
-- separately blocked. A Doctor login reaches an empty sidebar and 403s
-- everywhere, which is correct for "not built yet" rather than a bug.

-- ─── staff_users ─────────────────────────────────────────────────────────────
-- The staff directory and the source of truth for role/branch assignment.
-- Mirrors `customers` in shape: `auth_user_id` FK (0001's customers.auth_user_id),
-- `deactivated_at` soft-deactivation (0019's customers.deactivated_at) rather
-- than a bare boolean that could drift from a separately-tracked ban state.
--
-- branch_id is nullable at the schema level; "required when roles.is_branch_scoped"
-- is enforced in the StaffModule service, not a DB trigger — matching this
-- codebase's established "API is real enforcement" convention (0006, 0009)
-- rather than CHECK-constraint magic that would need its own maintenance as
-- roles.is_branch_scoped changes.

create table if not exists public.staff_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  role_id       text not null references public.roles(id),
  branch_id     uuid references public.branches(id),
  full_name     text not null,
  email         text not null,
  deactivated_at timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

comment on table public.staff_users is
  'The staff directory (SPEC-08 R1 user management screen) and source of truth for role/branch assignment. Every insert/update also syncs auth.users.app_metadata via the Admin API, so JWT-based checks (RolesGuard''s successor, is_super_admin(), apps/admin/middleware.ts) stay correct without a token refresh.';
comment on column public.staff_users.deactivated_at is
  'Set by an admin deactivating this staff account, cleared on reactivation. NULL = active. Mirrors customers.deactivated_at (0019) — the auth.users row is banned/unbanned in lockstep via the Admin API, same reasoning: a deactivated staff member must not be able to sign in, not just be hidden from a list.';

create index if not exists staff_users_role_idx on public.staff_users(role_id);
create index if not exists staff_users_branch_idx on public.staff_users(branch_id);

-- Backfill: every existing super_admin auth user gets a staff_users row,
-- satisfying "existing super_admin accounts migrate without interruption"
-- without touching app_metadata, which migration 0007 already set correctly.
insert into public.staff_users (auth_user_id, role_id, full_name, email)
select
  u.id,
  'super_admin',
  coalesce(u.raw_user_meta_data ->> 'full_name', 'Super Admin'),
  u.email
from auth.users u
where u.raw_app_meta_data ->> 'role' = 'super_admin'
on conflict (auth_user_id) do nothing;

-- ─── audit_log ───────────────────────────────────────────────────────────────
-- Append-only. actor_role and branch_id are DENORMALIZED deliberately: a
-- staff member's role/branch can change after the fact, and an audit entry
-- must keep reading correctly as "what were they at the time", not "what are
-- they now". before/after are the mutated resource's state, captured by the
-- caller (AuditLogService.record()) at the point of mutation — see the
-- companion PR for why this is an explicit call per mutation site rather than
-- a generic interceptor.

create table if not exists public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_role     text not null,
  action         text not null,
  resource_type  text not null,
  resource_id    text,
  branch_id      uuid,
  before         jsonb,
  after          jsonb,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.audit_log is
  'Every privileged action, retained indefinitely (SPEC-08 R1: "3 months minimum" is a floor, not a TTL — nothing here prunes). actor_role and branch_id are denormalized to reflect the actor''s state at the time of the action, not their current one.';

create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);
create index if not exists audit_log_resource_idx on public.audit_log(resource_type, resource_id);
create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id);
create index if not exists audit_log_branch_idx on public.audit_log(branch_id);

-- ─── RLS: service-role only, on all 5 new tables ────────────────────────────
-- See the migration header for why no policies exist. This is the same
-- pattern as cron_runs (0021) and notification_log (0023) — operational data
-- with no direct-from-browser read path.

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_users enable row level security;
alter table public.audit_log enable row level security;
