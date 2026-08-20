-- ─────────────────────────────────────────────────────────────────────────────
-- 0028_stock_adjustments.sql
--
-- CR-01 Phase 1B, R2 sub-phase 2c — adjustments with reason codes. The tables
-- (`stock_adjustments`, `stock_adjustment_items`, `stock_adjustment_reasons`)
-- were already provisioned in migration 0026; this adds the one RPC that
-- posts an adjustment, `post_adjustment`.
--
-- WHY ONE RPC HANDLES BOTH DIRECTIONS
--   `stock_adjustment_items.direction` (migration 0026) is per LINE, not per
--   adjustment header — a single physical walk can legitimately both write
--   off a damaged frame (`remove`) and log a frame the system had no record
--   of (`add`, the 'found' path) in the same session. Splitting this into two
--   RPCs would force the caller to submit two separate adjustments for what
--   is, physically, one walk through the shop.
--
-- WHY 'add' CREATES A NEW SERIAL WITH cost_price_kes = NULL
--   SPEC-08's own edge case ("a physical count finds stock the system does
--   not have") means this path is in scope, not a data hole to patch over.
--   Fabricating a cost for a unit that was never actually received against a
--   GRN would corrupt FIFO valuation with a number that was never real —
--   worse than leaving it NULL, which every downstream cost/margin read
--   (R3's job) must already handle for exactly this reason.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- post_adjustment — creates the adjustment header and, per item: either
-- writes off an existing in-stock serial ('remove') or creates a brand new
-- serial with no cost/GRN lineage ('found', via 'add'). Locks the relevant
-- inventory rows at p_branch_id first, in canonical product_id order, per
-- migration 0026's lock-ordering rule.
--
-- p_items shape:
--   [{ "direction": "remove", "serial_id": "<uuid>", "reason_code": "<text>" },
--    { "direction": "add", "product_id": "<uuid>", "reason_code": "<text>" }, ...]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function post_adjustment(
  p_branch_id uuid,
  p_items     jsonb,
  p_actor_id  uuid,
  p_actor_role text,
  p_notes     text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_adjustment_id uuid;
  v_item          jsonb;
  v_direction     text;
  v_serial        record;
  v_new_serial_id uuid;
  v_product_id    uuid;
  v_reason        text;
begin
  if jsonb_array_length(p_items) is null or jsonb_array_length(p_items) = 0 then
    raise exception 'no_items_given';
  end if;

  perform i.branch_id
  from   inventory i
  where  i.branch_id = p_branch_id
    and  i.product_id in (
      select coalesce((elem->>'product_id')::uuid, (select product_id from product_serials where id = (elem->>'serial_id')::uuid))
      from   jsonb_array_elements(p_items) as elem
    )
  order  by i.product_id
  for update of i;

  insert into stock_adjustments (branch_id, actor_user_id, notes)
  values (p_branch_id, p_actor_id, p_notes)
  returning id into v_adjustment_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_direction := v_item->>'direction';
    v_reason := v_item->>'reason_code';

    -- These semantics are inventory invariants, not only HTTP validation:
    -- `found` creates stock, while damage/loss/expiry/supplier-return remove
    -- it. Keeping this here protects the ledger even if a future caller skips
    -- AdjustmentsService.
    if v_direction = 'remove' and v_reason = 'found' then
      raise exception 'invalid_reason_direction: found_requires_add';
    end if;
    if v_direction = 'add' and v_reason in ('damage', 'loss_theft', 'expired', 'returned_to_supplier') then
      raise exception 'invalid_reason_direction: %_requires_remove', v_reason;
    end if;

    if v_direction = 'remove' then
      select id, product_id, current_branch_id into v_serial
      from product_serials
      where id = (v_item->>'serial_id')::uuid
      for update;

      if not found then
        raise exception 'serial_not_found: %', v_item->>'serial_id';
      end if;
      if v_serial.current_branch_id is distinct from p_branch_id or v_serial.current_branch_id is null then
        raise exception 'serial_not_in_stock_at_branch: %', v_serial.id;
      end if;

      update product_serials set status = 'written_off', current_branch_id = null where id = v_serial.id;

      insert into stock_adjustment_items (adjustment_id, serial_id, reason_code, direction)
      values (v_adjustment_id, v_serial.id, v_reason, 'remove');

      insert into stock_ledger (
        serial_id, product_id, movement_type, from_branch_id, reference_type, reference_id, actor_user_id, actor_role
      ) values (
        v_serial.id, v_serial.product_id, 'adjusted_out', p_branch_id, 'adjustment', v_adjustment_id, p_actor_id, p_actor_role
      );

      update inventory set stock = stock - 1, updated_at = now()
      where product_id = v_serial.product_id and branch_id = p_branch_id;

    elsif v_direction = 'add' then
      v_product_id := (v_item->>'product_id')::uuid;

      insert into product_serials (product_id, serial_number, status, current_branch_id, cost_price_kes, received_at)
      values (
        v_product_id,
        'FOUND-' || v_product_id || '-' || p_branch_id || '-' || gen_random_uuid(),
        'in_stock', p_branch_id, null, now()
      )
      returning id into v_new_serial_id;

      insert into stock_adjustment_items (adjustment_id, product_id, reason_code, direction)
      values (v_adjustment_id, v_product_id, v_reason, 'add');

      insert into stock_ledger (
        serial_id, product_id, movement_type, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
      ) values (
        v_new_serial_id, v_product_id, 'found', p_branch_id, 'adjustment', v_adjustment_id, p_actor_id, p_actor_role
      );

      insert into inventory (product_id, branch_id, stock)
      values (v_product_id, p_branch_id, 1)
      on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();

    else
      raise exception 'invalid_direction: %', v_direction;
    end if;
  end loop;

  return v_adjustment_id;
end;
$$;

revoke all on function post_adjustment(uuid, jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function post_adjustment(uuid, jsonb, uuid, text, text) to service_role;
