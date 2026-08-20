-- ─────────────────────────────────────────────────────────────────────────────
-- 0029_stock_counts.sql
--
-- CR-01 Phase 1B, R2 sub-phase 2d — physical stock counts. `stock_counts`/
-- `stock_count_items` were provisioned in migration 0026; this adds one
-- schema fix discovered while designing the scan flow, plus the RPC that
-- reconciles a completed count.
--
-- SCHEMA FIX: stock_count_items.scanned_serial_number
--   0026's stock_count_items had no free-text fallback for a scan that
--   matches no existing product_serials row — serial_id is null in exactly
--   that case, so the actual scanned string had nowhere to live until
--   accept_stock_count creates the real serial. Without it, that serial
--   number would have to be re-typed at accept time, or worse, invented.
--
-- WHY START/SCAN ARE PLAIN NESTJS WRITES BUT ACCEPT IS AN RPC
--   Starting a count snapshots what the system currently believes is on the
--   shelf; scanning marks items found or logs unexpected ones. Neither
--   touches `product_serials`/`inventory`/`stock_ledger` — same low-risk
--   class as a GRN's draft-and-line-editing phase (see 0026's own note on
--   why GRN creation doesn't need RPC-level atomicity). Only `accept` writes
--   the ledger, so only `accept` needs the atomicity/lock-ordering guarantee
--   every other R2 terminal action gets.
--
-- THE THREE OUTCOMES accept_stock_count RECONCILES
--   1. Expected, not found — the system believes it's here; the count says
--      no. Written off via the same reason-coded path as a manual
--      adjustment (reason 'count_correction'), not a silent status flip.
--   2. Found, not expected, but the serial already exists elsewhere in the
--      system (wrong branch, or marked sold/in_transit/written_off) — the
--      system's record was simply wrong. Relocated in place with a
--      'count_variance' ledger entry — this is neither a creation nor a
--      destruction of a unit, so it does not go through stock_adjustments
--      at all (that table's own CHECK constraint only models add/remove).
--   3. Found, not expected, and never seen before — SPEC-08's own edge case
--      ("a physical count finds stock the system does not have"). Same
--      'found' / cost_price_kes = NULL path a standalone adjustment uses.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

alter table public.stock_count_items
  add column if not exists scanned_serial_number text;

comment on column public.stock_count_items.scanned_serial_number is
  'The literal string scanned, when it matched no existing product_serials row (serial_id is null in that case). accept_stock_count uses this as the new serial''s actual serial_number — never a synthetic one.';

-- ─────────────────────────────────────────────────────────────────────────────
-- accept_stock_count — reconciles every unresolved line on an in-progress
-- count: writes off what's missing, relocates what was mistracked, and
-- creates serials for what was genuinely never recorded. Locks the relevant
-- inventory rows at the count's branch first, per migration 0026's
-- lock-ordering rule.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function accept_stock_count(
  p_count_id uuid,
  p_actor_id uuid,
  p_actor_role text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count            stock_counts%rowtype;
  v_adjustment_id     uuid;
  v_missing           record;
  v_relocated         record;
  v_new                record;
  v_new_serial_id      uuid;
  v_has_adjustment_rows boolean := false;
begin
  select * into v_count from stock_counts where id = p_count_id for update;
  if not found then
    raise exception 'count_not_found';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'count_already_resolved';
  end if;

  perform i.branch_id
  from   inventory i
  where  i.branch_id = v_count.branch_id
    and  i.product_id in (
      select coalesce(ps.product_id, sci.product_id)
      from   stock_count_items sci
      left join product_serials ps on ps.id = sci.serial_id
      where  sci.count_id = p_count_id
    )
  order  by i.product_id
  for update of i;

  -- Outcome 1: expected, not found — write off.
  for v_missing in
    select sci.serial_id, ps.product_id
    from   stock_count_items sci
    join   product_serials ps on ps.id = sci.serial_id
    where  sci.count_id = p_count_id and sci.expected and not sci.found
    for update of ps
  loop
    if not v_has_adjustment_rows then
      insert into stock_adjustments (branch_id, actor_user_id, notes)
      values (v_count.branch_id, p_actor_id, 'Stock count reconciliation — count ' || p_count_id)
      returning id into v_adjustment_id;
      v_has_adjustment_rows := true;
    end if;

    update product_serials set status = 'written_off', current_branch_id = null where id = v_missing.serial_id;

    insert into stock_adjustment_items (adjustment_id, serial_id, reason_code, direction)
    values (v_adjustment_id, v_missing.serial_id, 'count_correction', 'remove');

    insert into stock_ledger (
      serial_id, product_id, movement_type, from_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) values (
      v_missing.serial_id, v_missing.product_id, 'adjusted_out', v_count.branch_id, 'count', p_count_id, p_actor_id, p_actor_role
    );

    update inventory set stock = stock - 1, updated_at = now()
    where product_id = v_missing.product_id and branch_id = v_count.branch_id;
  end loop;

  -- Outcome 2: found, not expected, serial already exists elsewhere — relocate.
  for v_relocated in
    select sci.serial_id, ps.product_id, ps.status as prior_status, ps.current_branch_id as prior_branch_id
    from   stock_count_items sci
    join   product_serials ps on ps.id = sci.serial_id
    where  sci.count_id = p_count_id and not sci.expected and sci.found and sci.serial_id is not null
    for update of ps
  loop
    update product_serials set status = 'in_stock', current_branch_id = v_count.branch_id where id = v_relocated.serial_id;

    insert into stock_ledger (serial_id, product_id, movement_type, from_branch_id, to_branch_id, reference_type, reference_id, actor_user_id, actor_role)
    values (
      v_relocated.serial_id, v_relocated.product_id, 'count_variance',
      case when v_relocated.prior_status = 'in_stock' then v_relocated.prior_branch_id else null end,
      v_count.branch_id, 'count', p_count_id, p_actor_id, p_actor_role
    );

    if v_relocated.prior_status = 'in_stock' and v_relocated.prior_branch_id is not null then
      update inventory set stock = stock - 1, updated_at = now()
      where product_id = v_relocated.product_id and branch_id = v_relocated.prior_branch_id;
    end if;

    insert into inventory (product_id, branch_id, stock)
    values (v_relocated.product_id, v_count.branch_id, 1)
    on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();
  end loop;

  -- Outcome 3: found, not expected, never seen before — create.
  -- `sci.found` must stay qualified: bare `found` collides with plpgsql's own
  -- implicit FOUND variable and raises "column reference is ambiguous".
  for v_new in
    select sci.id as item_id, sci.product_id, sci.scanned_serial_number
    from   stock_count_items sci
    where  sci.count_id = p_count_id and not sci.expected and sci.found and sci.serial_id is null
  loop
    if v_new.product_id is null or v_new.scanned_serial_number is null then
      raise exception 'unresolved_unexpected_scan: %', v_new.item_id;
    end if;

    if not v_has_adjustment_rows then
      insert into stock_adjustments (branch_id, actor_user_id, notes)
      values (v_count.branch_id, p_actor_id, 'Stock count reconciliation — count ' || p_count_id)
      returning id into v_adjustment_id;
      v_has_adjustment_rows := true;
    end if;

    insert into product_serials (product_id, serial_number, status, current_branch_id, cost_price_kes, received_at)
    values (v_new.product_id, v_new.scanned_serial_number, 'in_stock', v_count.branch_id, null, now())
    returning id into v_new_serial_id;

    update stock_count_items set serial_id = v_new_serial_id where id = v_new.item_id;

    insert into stock_adjustment_items (adjustment_id, product_id, reason_code, direction)
    values (v_adjustment_id, v_new.product_id, 'found', 'add');

    insert into stock_ledger (
      serial_id, product_id, movement_type, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) values (
      v_new_serial_id, v_new.product_id, 'found', v_count.branch_id, 'count', p_count_id, p_actor_id, p_actor_role
    );

    insert into inventory (product_id, branch_id, stock)
    values (v_new.product_id, v_count.branch_id, 1)
    on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();
  end loop;

  update stock_counts set status = 'completed', completed_at = now() where id = p_count_id;
end;
$$;

revoke all on function accept_stock_count(uuid, uuid, text) from public, anon, authenticated;
grant execute on function accept_stock_count(uuid, uuid, text) to service_role;
