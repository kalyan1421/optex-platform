-- ─────────────────────────────────────────────────────────────────────────────
-- 0026_inventory_ledger.sql
--
-- CR-01 Phase 1B, R2 — the inventory ledger. SPEC-08 calls this "the largest
-- item" in the whole CR-01 programme: full per-frame serial tracking (every
-- physical frame is an individually tracked entity, receipt → transfer →
-- sale), FIFO cost valuation, goods-received notes against suppliers (no
-- Purchase Orders — confirmed out of scope), inter-branch transfers,
-- adjustments with reason codes, and physical stock counts.
--
-- WHAT THIS REPLACES
--   Today `inventory.stock` is one editable number per (product, branch),
--   set directly via `PATCH /admin/inventory` — no history, no reason, no
--   record of who changed what. This migration adds the tables and functions
--   that make stock DERIVED from an append-only ledger instead. The PATCH
--   endpoint itself is removed in the same PR that lands this migration
--   (apps/api/src/modules/inventory/) — every stock correction from here on
--   must go through a GRN, transfer, adjustment, or count, each of which
--   requires a reason and writes to `stock_ledger`.
--
-- WHY PER-SERIAL, NOT PER-BATCH, LEDGER ROWS
--   `stock_ledger` has ONE ROW PER SERIAL PER EVENT, not one row per GRN/
--   transfer/adjustment (a 50-unit GRN posting writes 50 ledger rows). A
--   header-referencing ledger (quantity-based) cannot answer "where is
--   serial X" without re-deriving membership from a header's line items
--   every time — and SPEC-08's own success metric is "time to answer 'where
--   did this frame go' < 2 minutes". `stock_ledger.reference_type` +
--   `reference_id` (unenforced, text + uuid — no FK) follows `audit_log`'s
--   own established precedent (migration 0025) rather than inventing a new
--   one.
--
-- WHY COST LIVES ON THE SERIAL, NOT A SEPARATE FIFO-LAYER TABLE
--   Because every physical unit is already individually tracked, FIFO
--   valuation is close to free: `product_serials.cost_price_kes` is the
--   ACTUAL cost this specific unit was received at. Consuming FIFO just
--   means "take the oldest `received_at` row first" — there is no separate
--   cost-layer ledger to keep in sync, which SKU-quantity FIFO would need.
--   This is deliberately NOT the same number as a future `products.cost_price`
--   (a static per-SKU catalogue figure, R3's job, not built here) — cost
--   price changing between receipts is exactly what FIFO exists to resolve
--   (SPEC-08's own edge case), so the two numbers are meant to diverge.
--
-- WHY EVERY MUTATING OPERATION IS ONE SECURITY DEFINER FUNCTION
--   Not a style choice. `orders.service.ts`'s own header comment records
--   that `place_order` replaced "an earlier best-effort insert/compensation
--   sequence that could orphan an order or lose a promo-usage update under
--   concurrency" — multi-step writes from NestJS against tables with real
--   invariants is a bug class this codebase already paid to fix once. GRN
--   posting (N serial inserts + N ledger inserts + a cache update) is
--   structurally identical to that fixed bug, for inventory truth instead
--   of a UX inconsistency — worse if it goes wrong, not better.
--
-- LOCK-ORDERING RULE (every function below follows this; stated once here
-- rather than repeated verbatim in each function's own comment)
--   Every function that writes `product_serials` takes the corresponding
--   `inventory` row lock(s) for `(product_id, branch_id)`, in ascending
--   `branch_id` order, BEFORE touching `product_serials` — mirrors 0020's
--   own "ORDERED LOCKING" section for `deduct_stock_fifo`/`place_order`.
--   `place_order` already did this by accident of call sequence; every new
--   function here does it deliberately, so a transfer-dispatch running
--   concurrently with a checkout on the same product can't race.
--
-- WHAT'S DELIBERATELY NOT HERE
--   `products.cost_price` (R3's static catalogue column, not this ledger's
--   per-receipt actual cost). Purchase Orders (client confirmed out of
--   scope — GRN is standalone). Branch P&L / margin computation (R3/R4).
--   Application-layer services/controllers for transfers, adjustments, and
--   counts — those tables exist here (so later sub-phases don't need a new
--   migration) but their NestJS modules land in R2 sub-phases 2b/2c/2d.
--
-- KNOWN GAP, NOTED NOT SILENTLY IGNORED
--   An order that sits `pending_payment` forever — never paid, never
--   cancelled by anyone — has no expiry/abandonment sweep in this system at
--   all, and its stock is never released. This is a genuinely pre-existing
--   Phase 1A gap (today it's invisible because a human retypes the number in
--   the grid), not something this migration introduces or fixes — it's an
--   order-lifecycle question (closer to SPEC-06) than an inventory-ledger
--   one. `restock_cancelled_order()` below only fires on an explicit
--   cancellation decision, which is the one unambiguous "this will never be
--   fulfilled" event this migration has a clean hook for.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── suppliers ───────────────────────────────────────────────────────────────

create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  phone        text,
  email        text,
  address      text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.suppliers is
  'Supplier master data (SPEC-08 R2). GRN receives stock directly against a supplier — no Purchase Orders.';

-- ─── stock_adjustment_reasons ────────────────────────────────────────────────
-- Data, not an enum — Optex edits this list without a deploy, same "roles are
-- data" philosophy as 0025's roles/permissions tables. Client's own reason
-- list is still open (CLIENT-ANSWERS Q7); this is a sane starting default.

create table if not exists public.stock_adjustment_reasons (
  id          text primary key,
  description text not null
);

comment on table public.stock_adjustment_reasons is
  'Editable-as-data reason codes for stock adjustments. Client''s own list (CLIENT-ANSWERS Q7) is still open — this is a starting default, not final.';

insert into public.stock_adjustment_reasons (id, description) values
  ('damage',              'Frame damaged and no longer sellable.'),
  ('loss_theft',          'Missing — lost or stolen.'),
  ('expired',             'Past any usable/sellable date.'),
  ('returned_to_supplier','Sent back to the supplier (e.g. defect on arrival).'),
  ('found',               'Physical stock found that the system had no record of.'),
  ('count_correction',    'Correcting a variance discovered during a physical count.'),
  ('other',               'Any other reason — use the notes field.')
on conflict (id) do nothing;

-- ─── goods_received_notes / goods_received_items ────────────────────────────
-- Created before product_serials, which references goods_received_items.

create sequence if not exists grn_number_seq start 1;
create or replace function generate_grn_number()
returns text language sql as $$
  select 'GRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('grn_number_seq')::text, 6, '0');
$$;

create table if not exists public.goods_received_notes (
  id           uuid primary key default gen_random_uuid(),
  grn_number   text not null unique default generate_grn_number(),
  supplier_id  uuid not null references public.suppliers(id) on delete restrict,
  branch_id    uuid not null references public.branches(id) on delete restrict,
  status       text not null default 'draft' check (status in ('draft','posted')),
  received_by  uuid references auth.users(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  posted_at    timestamptz
);

comment on table public.goods_received_notes is
  'GRN header. Standalone — no Purchase Order to reconcile against (client confirmed out of scope). Posting (draft -> posted) is what actually creates stock; see post_grn().';

create table if not exists public.goods_received_items (
  id               uuid primary key default gen_random_uuid(),
  grn_id           uuid not null references public.goods_received_notes(id) on delete cascade,
  product_id       uuid not null references public.products(id) on delete restrict,
  unit_cost_kes    numeric(10,2) not null check (unit_cost_kes >= 0),
  quantity_ordered int not null check (quantity_ordered > 0)
);

comment on table public.goods_received_items is
  'GRN line. Posting creates quantity_ordered product_serials rows, each stamped with this line''s unit_cost_kes.';

create index if not exists goods_received_items_grn_idx on public.goods_received_items(grn_id);

-- ─── product_serials ─────────────────────────────────────────────────────────
-- The physical-unit registry — one row per frame, ever. `status` and
-- `current_branch_id` are a DENORMALIZED CACHE (same pattern as
-- products.rating_avg/rating_count, migration 0024): `stock_ledger` is the
-- source of truth, this is the fast-read projection every function below
-- keeps in sync as it writes ledger rows.

create table if not exists public.product_serials (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  serial_number    text not null unique,
  status           text not null default 'in_stock'
                     check (status in ('in_stock','in_transit','sold','returned','written_off')),
  current_branch_id uuid references public.branches(id) on delete set null,
  -- NULL cost = this unit did not come from a GRN (an adjustment "found" or a
  -- physical count's unexpected-serial path) — NEVER fabricated. Margin/aging
  -- reports (R3) must flag these explicitly rather than compute a false 100%,
  -- extending SPEC-08 R3's own stated rule for missing cost price.
  cost_price_kes   numeric(10,2),
  grn_item_id      uuid references public.goods_received_items(id) on delete set null,
  received_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table public.product_serials is
  'One row per physical frame, ever. status/current_branch_id are a cache — stock_ledger is the source of truth.';

create index if not exists product_serials_product_idx on public.product_serials(product_id);
create index if not exists product_serials_branch_idx on public.product_serials(current_branch_id);
create index if not exists product_serials_status_idx on public.product_serials(status);
-- FIFO consumption's hot path: "oldest in-stock serial for this product".
create index if not exists product_serials_fifo_idx
  on public.product_serials(product_id, received_at)
  where status = 'in_stock';

-- ─── stock_transfers / stock_transfer_items ──────────────────────────────────

create sequence if not exists transfer_number_seq start 1;
create or replace function generate_transfer_number()
returns text language sql as $$
  select 'TRF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('transfer_number_seq')::text, 6, '0');
$$;

create table if not exists public.stock_transfers (
  id              uuid primary key default gen_random_uuid(),
  transfer_number text not null unique default generate_transfer_number(),
  from_branch_id  uuid not null references public.branches(id) on delete restrict,
  to_branch_id    uuid not null references public.branches(id) on delete restrict,
  status          text not null default 'pending'
                    check (status in ('pending','in_transit','received','cancelled')),
  requested_by    uuid references auth.users(id) on delete set null,
  dispatched_at   timestamptz,
  received_at     timestamptz,
  notes           text,
  check (from_branch_id <> to_branch_id)
);

comment on table public.stock_transfers is
  'Inter-branch transfer header. status is derived from the aggregate of stock_transfer_items — a transfer can be partially received.';

create table if not exists public.stock_transfer_items (
  id          uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  serial_id   uuid not null references public.product_serials(id) on delete restrict,
  -- PER-LINE status, not just a header one: SPEC-08's own edge case ("a
  -- transfer is dispatched but never arrives") needs partial receipt — 8 of
  -- 10 dispatched serials arriving is not representable with a header-only
  -- status. A 'lost' line requires a reason and becomes a stock_adjustments
  -- row (reference_type='transfer') in sub-phase 2b.
  status      text not null default 'in_transit'
                check (status in ('in_transit','received','lost'))
);

comment on table public.stock_transfer_items is
  'One row per serial being transferred. Per-line status is what makes partial receipt representable.';

create index if not exists stock_transfer_items_transfer_idx on public.stock_transfer_items(transfer_id);
create index if not exists stock_transfer_items_serial_idx on public.stock_transfer_items(serial_id);

-- ─── stock_adjustments / stock_adjustment_items ─────────────────────────────

create table if not exists public.stock_adjustments (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id) on delete restrict,
  actor_user_id  uuid references auth.users(id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);

comment on table public.stock_adjustments is
  'Adjustment header (branch + actor + notes). Reason lives per LINE, not here — see stock_adjustment_items.';

create table if not exists public.stock_adjustment_items (
  id           uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.stock_adjustments(id) on delete cascade,
  -- 'remove' always has a serial_id (a specific known unit is written off).
  -- 'add' with NO serial_id + a product_id instead is the "stock the system
  -- doesn't have" case (SPEC-08's own edge case) — creates a brand new
  -- product_serials row with cost_price_kes = NULL.
  serial_id    uuid references public.product_serials(id) on delete restrict,
  product_id   uuid references public.products(id) on delete restrict,
  reason_code  text not null references public.stock_adjustment_reasons(id) on delete restrict,
  direction    text not null check (direction in ('add','remove')),
  check (
    (direction = 'remove' and serial_id is not null and product_id is null) or
    (direction = 'add' and serial_id is null and product_id is not null)
  )
);

comment on table public.stock_adjustment_items is
  'One row per unit adjusted. reason_code is PER-LINE — a "damage" reason only ever applies to a remove, "found" only to an add; one physical walk can find both in the same session.';

create index if not exists stock_adjustment_items_adjustment_idx on public.stock_adjustment_items(adjustment_id);

-- ─── stock_counts / stock_count_items ────────────────────────────────────────

create table if not exists public.stock_counts (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete restrict,
  status       text not null default 'in_progress'
                 check (status in ('in_progress','completed','cancelled')),
  started_by   uuid references auth.users(id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  notes        text
);

comment on table public.stock_counts is
  'Physical stock count header, scoped to one branch at a time.';

create table if not exists public.stock_count_items (
  id         uuid primary key default gen_random_uuid(),
  count_id   uuid not null references public.stock_counts(id) on delete cascade,
  serial_id  uuid references public.product_serials(id) on delete restrict,
  -- Nullable product_id: an unexpected serial scanned that isn't in the
  -- system at all can't have its product inferred from the serial string
  -- alone — the counter must select it manually before the count can be
  -- accepted (enforced in the app layer, sub-phase 2d).
  product_id uuid references public.products(id) on delete restrict,
  expected   boolean not null,
  found      boolean not null default false
);

comment on table public.stock_count_items is
  'One row per serial in scope for a count. expected=true rows come pre-populated from what the system believes is at this branch; expected=false rows are unexpected finds, requiring a manually-selected product_id.';

create index if not exists stock_count_items_count_idx on public.stock_count_items(count_id);

-- ─── stock_ledger ─────────────────────────────────────────────────────────────
-- The append-only audit trail. ONE ROW PER SERIAL PER EVENT. Nothing ever
-- updates or deletes a row here — see the migration header for why this
-- granularity, not a header-referencing one.

create table if not exists public.stock_ledger (
  id             uuid primary key default gen_random_uuid(),
  serial_id      uuid not null references public.product_serials(id) on delete restrict,
  product_id     uuid not null references public.products(id) on delete restrict,
  movement_type  text not null check (movement_type in (
                   'received','transfer_out','transfer_in','sold','sale_reversed',
                   'adjusted_in','adjusted_out','found','count_variance'
                 )),
  from_branch_id uuid references public.branches(id) on delete restrict,
  to_branch_id   uuid references public.branches(id) on delete restrict,
  -- Unenforced by design — matches audit_log's own resource_type/resource_id
  -- precedent (migration 0025) rather than inventing a new one.
  reference_type text not null,
  reference_id   uuid,
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_role     text,
  created_at     timestamptz not null default now()
);

comment on table public.stock_ledger is
  'Append-only. One row per serial per movement event. This is what makes "trace this serial''s full history" a single indexed query.';

create index if not exists stock_ledger_serial_idx on public.stock_ledger(serial_id, created_at);
create index if not exists stock_ledger_product_idx on public.stock_ledger(product_id, created_at desc);
create index if not exists stock_ledger_reference_idx on public.stock_ledger(reference_type, reference_id);

-- ─── RLS: service-role only, on every new table ─────────────────────────────
-- Same idiom as 0025 — apps/admin never queries Postgres directly, so real
-- enforcement lives in the API's PermissionsGuard, not RLS.

alter table public.suppliers enable row level security;
alter table public.stock_adjustment_reasons enable row level security;
alter table public.product_serials enable row level security;
alter table public.goods_received_notes enable row level security;
alter table public.goods_received_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.stock_ledger enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- CUTOVER GATE
--
-- `deduct_stock_fifo` changes from consuming `inventory.stock` to consuming
-- actual in-stock serials below. Allowing this migration onto a populated
-- legacy database without first capturing each physical serial would leave a
-- positive cache but zero sellable units. That is worse than a failed deploy:
-- it silently turns real stock into unavailable stock. The release operator
-- must complete an opening serial import/physical count until this check is
-- clean, then rerun the migration. Fresh local databases pass because both
-- sides start at zero; the dev seed adds matching serials afterwards.
do $$
begin
  if exists (
    select 1
    from inventory i
    left join lateral (
      select count(*)::int as serial_stock
      from product_serials ps
      where ps.product_id = i.product_id
        and ps.current_branch_id = i.branch_id
        and ps.status = 'in_stock'
    ) ps on true
    where i.stock <> ps.serial_stock
  ) then
    raise exception using
      message = 'inventory_serial_cutover_required',
      detail = 'Each positive inventory row must have the same number of in_stock product_serials before enabling serial-backed checkout.',
      hint = 'Run the approved opening serial import/physical count and reconcile inventory.stock before applying 0026.';
  end if;
end;
$$;

-- Read-side reconciliation for the cutover and ongoing operations. The
-- `inventory.stock` cache remains intentionally fast to read, but this report
-- makes any divergence from the serial projection explicit and exportable.
create or replace function inventory_reconciliation_report(p_branch_id uuid default null)
returns table (
  product_id uuid,
  product_name text,
  product_sku text,
  branch_id uuid,
  branch_name text,
  cached_stock int,
  serial_stock int,
  difference int
)
language sql
security definer set search_path = public
as $$
  select
    i.product_id,
    p.name,
    p.sku,
    i.branch_id,
    b.name,
    i.stock,
    count(ps.id)::int,
    i.stock - count(ps.id)::int
  from inventory i
  join products p on p.id = i.product_id
  join branches b on b.id = i.branch_id
  left join product_serials ps
    on ps.product_id = i.product_id
   and ps.current_branch_id = i.branch_id
   and ps.status = 'in_stock'
  where p_branch_id is null or i.branch_id = p_branch_id
  group by i.product_id, p.name, p.sku, i.branch_id, b.name, i.stock
  order by b.name, p.name;
$$;

revoke all on function inventory_reconciliation_report(uuid) from public, anon, authenticated;
grant execute on function inventory_reconciliation_report(uuid) to service_role;

-- `deduct_stock_fifo`'s signature changes (adds p_order_item_id, so ledger rows can
-- reference the exact order line that consumed the serial) — CREATE OR REPLACE cannot
-- change a function's argument list, it creates a second overload instead, so
-- the 2-arg version is dropped explicitly first. Its only caller (place_order)
-- is updated in the same migration.
drop function if exists deduct_stock_fifo(uuid, int);

-- ─────────────────────────────────────────────────────────────────────────────
-- deduct_stock_fifo — R2 rewrite.
--
-- BEHAVIOUR CHANGE: was "ORDER BY stock DESC" (most-stocked branch first —
-- confirmed via stock.e2e-spec.ts that no test depends on WHICH branch is
-- decremented, only the aggregate). Now "ORDER BY received_at ASC" over
-- product_serials — genuinely FIFO by receipt date, finally matching the
-- function's name. Still spans multiple branches to fulfil a quantity, same
-- as before (orders.branch_id stays unpopulated by place_order).
--
-- LOCK ORDERING: locks every inventory row this product could be consumed
-- from, in canonical (product_id, branch_id) order, before touching
-- product_serials. place_order already does this for the whole cart before
-- calling here; repeated inside this function too so it is safe regardless
-- of caller (see migration header).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function deduct_stock_fifo(
  p_product_id uuid,
  p_qty        int,
  p_order_item_id uuid,
  p_actor_id   uuid,
  p_actor_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_remaining int := p_qty;
  v_serial    record;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN;
  END IF;

  PERFORM i.branch_id
  FROM   inventory i
  JOIN   branches b ON b.id = i.branch_id AND b.is_active
  WHERE  i.product_id = p_product_id
  ORDER  BY i.branch_id
  FOR UPDATE OF i;

  FOR v_serial IN
    SELECT ps.id, ps.current_branch_id
    FROM   product_serials ps
    JOIN   branches b ON b.id = ps.current_branch_id AND b.is_active
    WHERE  ps.product_id = p_product_id
      AND  ps.status = 'in_stock'
    ORDER  BY ps.received_at ASC, ps.id
    FOR UPDATE OF ps
  LOOP
    EXIT WHEN v_remaining <= 0;

    UPDATE product_serials
    SET    status = 'sold', current_branch_id = NULL
    WHERE  id = v_serial.id;

    INSERT INTO stock_ledger (
      serial_id, product_id, movement_type, from_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) VALUES (
      v_serial.id, p_product_id, 'sold', v_serial.current_branch_id, 'order_item', p_order_item_id, p_actor_id, p_actor_role
    );

    UPDATE inventory
    SET    stock = stock - 1,
           updated_at = now()
    WHERE  product_id = p_product_id
      AND  branch_id  = v_serial.current_branch_id;

    v_remaining := v_remaining - 1;
  END LOOP;

  IF v_remaining > 0 THEN
    -- Belt and braces: place_order checks availability first, but a concurrent
    -- admin edit between the check and here would land us short. Raising aborts
    -- the whole checkout rather than shipping a partially-deducted order.
    RAISE EXCEPTION 'insufficient_stock';
  END IF;
END;
$$;

revoke all on function deduct_stock_fifo(uuid, int, uuid, uuid, text) from public, anon, authenticated;
grant execute on function deduct_stock_fifo(uuid, int, uuid, uuid, text) to service_role;

-- place_order threads each order item through to deduct_stock_fifo, so sold
-- serials can be traced back to (and later restocked from) the exact line that
-- consumed them.
CREATE OR REPLACE FUNCTION place_order(
  p_customer_id     uuid,
  p_payment_method  text,
  p_shipping        jsonb,
  p_delivery_option text,
  p_promo_code      text
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart_id      uuid;
  v_subtotal     numeric(10,2);
  v_promo        promo_codes%ROWTYPE;
  v_applied_code text := NULL;
  v_promo_base   numeric(10,2) := 0;
  v_discount     numeric(10,2) := 0;
  v_taxable_base numeric(10,2);
  v_vat          numeric(10,2);
  v_shipping     numeric(10,2);
  v_total        numeric(10,2);
  v_status       order_status;
  v_order        orders%ROWTYPE;
  v_now          timestamptz := now();
  v_short        record;
  v_line         record;
BEGIN
  SELECT id INTO v_cart_id FROM carts WHERE customer_id = p_customer_id;
  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'Your cart is empty.';
  END IF;

  PERFORM id FROM cart_items WHERE cart_id = v_cart_id FOR UPDATE;

  PERFORM i.product_id
  FROM   inventory i
  JOIN   branches b ON b.id = i.branch_id AND b.is_active
  WHERE  i.product_id IN (SELECT ci.product_id FROM cart_items ci WHERE ci.cart_id = v_cart_id)
  ORDER  BY i.product_id, i.branch_id
  FOR UPDATE OF i;

  SELECT p.name AS product_name, ci.quantity AS wanted, coalesce(s.available, 0) AS available
  INTO   v_short
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  LEFT JOIN LATERAL (
    SELECT sum(i.stock)::int AS available
    FROM   inventory i
    JOIN   branches b ON b.id = i.branch_id AND b.is_active
    WHERE  i.product_id = ci.product_id
  ) s ON true
  WHERE  ci.cart_id = v_cart_id AND ci.quantity > coalesce(s.available, 0)
  ORDER  BY p.name LIMIT  1;

  IF FOUND THEN
    RAISE EXCEPTION 'insufficient_stock:%:%:%', v_short.product_name, v_short.wanted, v_short.available;
  END IF;

  SELECT round(coalesce(sum(p.price_kes * ci.quantity), 0), 2) INTO v_subtotal
  FROM cart_items ci JOIN products p ON p.id = ci.product_id AND p.is_active
  WHERE ci.cart_id = v_cart_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Your cart is empty or contains only unavailable products.';
  END IF;

  IF p_promo_code IS NOT NULL AND length(btrim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM promo_codes WHERE code = btrim(p_promo_code) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promo code not found.'; END IF;
    IF NOT v_promo.is_active THEN RAISE EXCEPTION 'This promo code is no longer active.'; END IF;
    IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > v_now THEN RAISE EXCEPTION 'This promo code is not yet valid.'; END IF;
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < v_now THEN RAISE EXCEPTION 'This promo code has expired.'; END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.uses >= v_promo.max_uses THEN RAISE EXCEPTION 'This promo code has reached its usage limit.'; END IF;

    IF v_promo.category_id IS NULL THEN
      v_promo_base := v_subtotal;
    ELSE
      SELECT round(coalesce(sum(p.price_kes * ci.quantity), 0), 2) INTO v_promo_base
      FROM cart_items ci JOIN products p ON p.id = ci.product_id AND p.is_active
      WHERE ci.cart_id = v_cart_id AND p.category_id = v_promo.category_id;
    END IF;

    IF v_promo_base <= 0 THEN RAISE EXCEPTION 'This promo code does not apply to any item in your cart.'; END IF;

    IF v_promo.discount_type = 'percent' THEN
      v_discount := round((v_promo_base * v_promo.value) / 100, 2);
    ELSE
      v_discount := round(v_promo.value, 2);
    END IF;
    v_discount := round(least(greatest(v_discount, 0), v_promo_base), 2);
    v_applied_code := v_promo.code;
  END IF;

  v_taxable_base := round(v_subtotal - v_discount, 2);
  v_vat          := round(v_taxable_base * 0.16, 2);
  v_shipping     := CASE WHEN p_delivery_option = 'pickup' THEN 0 ELSE 300 END;
  v_total        := round(v_taxable_base + v_vat + v_shipping, 2);

  v_status := CASE WHEN p_payment_method = 'cod' THEN 'received'::order_status ELSE 'pending_payment'::order_status END;

  INSERT INTO orders (
    customer_id, subtotal_kes, discount_kes, vat_kes, shipping_kes, total_kes,
    status, payment_method, payment_status, promo_code, shipping
  )
  VALUES (
    p_customer_id, v_subtotal, v_discount, v_vat, v_shipping, v_total,
    v_status, p_payment_method::payment_method, 'pending'::payment_status,
    v_applied_code, p_shipping
  )
  RETURNING * INTO v_order;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price_kes, lens_option)
  SELECT v_order.id, ci.product_id, ci.quantity, p.price_kes, ci.lens_option
  FROM cart_items ci JOIN products p ON p.id = ci.product_id AND p.is_active
  WHERE ci.cart_id = v_cart_id;

  FOR v_line IN
    SELECT oi.id AS order_item_id, oi.product_id, oi.quantity AS qty
    FROM order_items oi
    WHERE oi.order_id = v_order.id
    ORDER BY oi.product_id, oi.id
  LOOP
    PERFORM deduct_stock_fifo(v_line.product_id, v_line.qty, v_line.order_item_id, p_customer_id, 'customer');
  END LOOP;

  IF v_applied_code IS NOT NULL THEN
    PERFORM increment_promo_uses(v_applied_code);
  END IF;

  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  UPDATE carts SET promo_code = NULL WHERE id = v_cart_id;

  RETURN v_order;
END;
$$;

revoke all on function place_order(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function place_order(uuid, text, jsonb, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- post_grn — draft -> posted. Creates one product_serials row per submitted
-- serial number, stamped with its line's unit_cost_kes, plus one 'received'
-- stock_ledger row each, and increments the inventory cache. Atomic: a
-- duplicate serial number anywhere aborts the whole post (unique_violation on
-- product_serials.serial_number), same all-or-nothing guarantee place_order
-- gives checkout.
--
-- p_serials shape: [{ "grn_item_id": "<uuid>", "serial_number": "<text>" }, ...]
-- — flattened across every line on the GRN; NestJS validates each line's
-- submitted count against quantity_ordered before calling this.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function post_grn(
  p_grn_id     uuid,
  p_serials    jsonb,
  p_actor_id   uuid,
  p_actor_role text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_grn         goods_received_notes%rowtype;
  v_item        goods_received_items%rowtype;
  v_serial      jsonb;
  v_new_serial  uuid;
begin
  select * into v_grn from goods_received_notes where id = p_grn_id for update;
  if not found then
    raise exception 'grn_not_found';
  end if;
  if v_grn.status = 'posted' then
    raise exception 'grn_already_posted';
  end if;

  perform i.branch_id
  from   inventory i
  join   goods_received_items gi on gi.product_id = i.product_id
  where  gi.grn_id = p_grn_id and i.branch_id = v_grn.branch_id
  order  by i.product_id
  for update of i;

  for v_serial in select * from jsonb_array_elements(p_serials)
  loop
    select * into v_item from goods_received_items
    where id = (v_serial->>'grn_item_id')::uuid and grn_id = p_grn_id;
    if not found then
      raise exception 'grn_item_not_found: %', v_serial->>'grn_item_id';
    end if;

    insert into product_serials (
      product_id, serial_number, status, current_branch_id, cost_price_kes, grn_item_id, received_at
    ) values (
      v_item.product_id, v_serial->>'serial_number', 'in_stock', v_grn.branch_id,
      v_item.unit_cost_kes, v_item.id, now()
    )
    returning id into v_new_serial;

    insert into stock_ledger (
      serial_id, product_id, movement_type, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) values (
      v_new_serial, v_item.product_id, 'received', v_grn.branch_id, 'grn', p_grn_id, p_actor_id, p_actor_role
    );

    insert into inventory (product_id, branch_id, stock)
    values (v_item.product_id, v_grn.branch_id, 1)
    on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();
  end loop;

  update goods_received_notes set status = 'posted', posted_at = now() where id = p_grn_id;
end;
$$;

revoke all on function post_grn(uuid, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function post_grn(uuid, jsonb, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- restock_cancelled_order — the fix for a real gap a design-review pass
-- caught: cancellation approval (cancellation.service.ts's approve()/
-- adminCancel()) marks an order 'cancelled' but never released the specific
-- serials it consumed. Invisible today (a human retypes the grid number);
-- once PATCH /admin/inventory is gone, every approved cancellation on a
-- serial-tracked product would be permanent, silent shrinkage.
--
-- Deliberately NOT triggered by a failed payment TRANSACTION —
-- payments.service.ts's assertPayable() allows retrying a pending_payment
-- order indefinitely, so a single failed STK push does not mean the order is
-- dead; restocking there would release stock for an order that might still
-- be paid seconds later.
--
-- Idempotent: the NOT EXISTS guard means calling this twice for the same
-- order (a retry, a race) does not double-credit stock — same "credited at
-- most once" posture payments.service.ts already holds for the sale side.
--
-- Silently a no-op for orders placed before this migration: their stock was
-- deducted by the OLD deduct_stock_fifo, which never wrote to product_serials
-- or stock_ledger, so there is nothing here to trace back. Documented
-- limitation, not a bug — those orders can't be serial-traced at all either.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function restock_cancelled_order(
  p_order_id   uuid,
  p_actor_id   uuid,
  p_actor_role text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_row record;
begin
  perform i.branch_id
  from   inventory i
  where  (i.product_id, i.branch_id) in (
    select sl.product_id, sl.from_branch_id
    from   stock_ledger sl
    join   order_items oi on oi.id = sl.reference_id
    where  sl.reference_type = 'order_item' and oi.order_id = p_order_id
      and  sl.movement_type = 'sold' and sl.from_branch_id is not null
  )
  order  by i.product_id, i.branch_id
  for update of i;

  for v_row in
    select sl.serial_id, sl.product_id, sl.from_branch_id, sl.reference_id as order_item_id
    from   stock_ledger sl
    join   order_items oi on oi.id = sl.reference_id
    where  sl.reference_type = 'order_item' and oi.order_id = p_order_id
      and  sl.movement_type = 'sold'
      and not exists (
        select 1 from stock_ledger r
        where  r.serial_id = sl.serial_id
          and  r.reference_type = 'order_item' and r.reference_id = sl.reference_id
          and  r.movement_type = 'sale_reversed'
      )
  loop
    if v_row.from_branch_id is null then
      -- No recorded origin branch — nothing safe to do. Skip rather than guess.
      continue;
    end if;

    update product_serials
    set    status = 'in_stock', current_branch_id = v_row.from_branch_id
    where  id = v_row.serial_id;

    insert into stock_ledger (
      serial_id, product_id, movement_type, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) values (
      v_row.serial_id, v_row.product_id, 'sale_reversed', v_row.from_branch_id, 'order_item', v_row.order_item_id, p_actor_id, p_actor_role
    );

    insert into inventory (product_id, branch_id, stock)
    values (v_row.product_id, v_row.from_branch_id, 1)
    on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();
  end loop;
end;
$$;

revoke all on function restock_cancelled_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function restock_cancelled_order(uuid, uuid, text) to service_role;

-- Cancelling an order and restoring its allocated serials must be one database
-- transaction. Calling a restock RPC after a separate UPDATE leaves permanent
-- stock drift if the second call fails.
create or replace function cancel_order_and_restock(
  p_order_id   uuid,
  p_notes      text,
  p_actor_id   uuid,
  p_actor_role text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'order_already_cancelled';
  end if;

  update orders
  set status = 'cancelled',
      notes = coalesce(p_notes, notes)
  where id = p_order_id;

  perform restock_cancelled_order(p_order_id, p_actor_id, p_actor_role);
end;
$$;

revoke all on function cancel_order_and_restock(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function cancel_order_and_restock(uuid, text, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permissions (extends migration 0025's matrix)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.permissions (id, description) values
  ('inventory.receive', 'Receive goods against a supplier (post a GRN).'),
  ('inventory.transfer', 'Dispatch and receive inter-branch stock transfers.'),
  ('inventory.adjust', 'Adjust stock with a reason code (damage, loss, found, etc).'),
  ('inventory.count', 'Run and accept physical stock counts.'),
  ('suppliers.manage', 'Create, edit, and deactivate suppliers.')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('inventory_manager', 'inventory.receive'),
  ('inventory_manager', 'inventory.transfer'),
  ('inventory_manager', 'inventory.adjust'),
  ('inventory_manager', 'inventory.count'),
  ('inventory_manager', 'suppliers.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'super_admin', id from public.permissions
where id in ('inventory.receive','inventory.transfer','inventory.adjust','inventory.count','suppliers.manage')
on conflict do nothing;

-- `inventory.write` (migration 0025) is retired — its own comment already
-- called it "transitional... this grant will be revisited then". Deleting the
-- permission row cascades to every role_permissions grant referencing it
-- (0025's role_permissions.permission_id is ON DELETE CASCADE), which is what
-- removes branch_manager's write access — SPEC-08's own User Stories give
-- Branch Manager zero R2 write stories, only read ("see only my own branch's
-- data"). inventory_manager's replacement grants are the five above.
delete from public.permissions where id = 'inventory.write';
