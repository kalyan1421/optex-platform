-- ─────────────────────────────────────────────────────────────────────────────
-- 0027_stock_transfers.sql
--
-- CR-01 Phase 1B, R2 sub-phase 2b — inter-branch transfers. The tables
-- (`stock_transfers`, `stock_transfer_items`) were already provisioned in
-- migration 0026 alongside the rest of the R2 schema; this migration adds the
-- two RPCs that actually move stock: `dispatch_transfer` (from-branch releases
-- specific serials into transit) and `receive_transfer` (to-branch resolves
-- each transferred serial as arrived or lost).
--
-- WHY DISPATCH AND RECEIVE ARE SEPARATE RPCS, NOT ONE "CREATE TRANSFER" CALL
--   SPEC-08's own edge case is "a transfer is dispatched but never arrives" —
--   which requires the dispatch moment and the receive moment to be genuinely
--   distinct events, potentially far apart in time, with the serials sitting
--   in an `in_transit` limbo between them that belongs to neither branch.
--   Combining them into one call would make that limbo unrepresentable.
--
-- WHY current_branch_id GOES NULL WHILE in_transit
--   A frame in a vehicle between branches is not "at" either branch. Same
--   convention `deduct_stock_fifo` already uses for a sold serial (migration
--   0026) — current_branch_id is only ever meaningful for a serial that is
--   actually sitting on a shelf somewhere.
--
-- WHY A LOST LINE BECOMES A stock_adjustments ROW, NOT A BARE STATUS FLIP
--   Shrinkage discovered mid-transfer is still shrinkage — it needs the same
--   reason-coded, audited trail as any other write-off, not a silent status
--   change nobody but the transfer record shows. Recorded against the
--   destination branch (where the gap is actually discovered and where the
--   receiving clerk is doing the reconciling), referencing
--   reference_type='transfer' so it's traceable back to which transfer lost
--   the unit.
--
-- WHY HEADER STATUS HAS NO SEPARATE "PARTIALLY RECEIVED" VALUE
--   `stock_transfers.status` (migration 0026) is derived from the aggregate
--   of its lines, same principle as an order's status being one value even
--   though its items can differ. Once every line has reached a terminal
--   state (received or lost) the header reads 'received' — "the transfer
--   process is over", not "every unit made it". A caller who needs to know
--   whether anything was lost reads the lines, same way a caller who needs
--   line-level order detail reads order_items rather than inferring it from
--   orders.status.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- dispatch_transfer — creates the transfer header and one stock_transfer_items
-- row per serial, atomically flips each serial to 'in_transit', writes a
-- 'transfer_out' ledger row per serial, and decrements the inventory cache at
-- the origin branch. Every serial must currently be 'in_stock' at
-- p_from_branch_id — locked in canonical (product_id, branch_id) order first,
-- per migration 0026's lock-ordering rule, so a dispatch racing a checkout on
-- the same product can't corrupt either.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function dispatch_transfer(
  p_from_branch_id uuid,
  p_to_branch_id   uuid,
  p_serial_ids     uuid[],
  p_requested_by   uuid,
  p_actor_role     text,
  p_notes          text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer_id uuid;
  v_serial      record;
begin
  if p_from_branch_id = p_to_branch_id then
    raise exception 'from_branch_and_to_branch_must_differ';
  end if;
  if array_length(p_serial_ids, 1) is null then
    raise exception 'no_serials_given';
  end if;

  perform i.branch_id
  from   inventory i
  where  i.branch_id = p_from_branch_id
    and  i.product_id in (select product_id from product_serials where id = any(p_serial_ids))
  order  by i.product_id
  for update of i;

  insert into stock_transfers (from_branch_id, to_branch_id, status, requested_by, dispatched_at, notes)
  values (p_from_branch_id, p_to_branch_id, 'in_transit', p_requested_by, now(), p_notes)
  returning id into v_transfer_id;

  for v_serial in
    select id, product_id, current_branch_id
    from   product_serials
    where  id = any(p_serial_ids)
    for update
  loop
    if v_serial.current_branch_id is distinct from p_from_branch_id then
      raise exception 'serial_not_in_stock_at_origin: %', v_serial.id;
    end if;

    insert into stock_transfer_items (transfer_id, serial_id, status)
    values (v_transfer_id, v_serial.id, 'in_transit');

    update product_serials set status = 'in_transit', current_branch_id = null where id = v_serial.id;

    insert into stock_ledger (
      serial_id, product_id, movement_type, from_branch_id, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
    ) values (
      v_serial.id, v_serial.product_id, 'transfer_out', p_from_branch_id, p_to_branch_id, 'transfer', v_transfer_id, p_requested_by, p_actor_role
    );

    update inventory set stock = stock - 1, updated_at = now()
    where product_id = v_serial.product_id and branch_id = p_from_branch_id;
  end loop;

  -- Every id in p_serial_ids must have matched a locked, in-stock-at-origin
  -- row — a bad id (wrong product, wrong branch, already elsewhere) is
  -- exactly the kind of mistake this function exists to catch atomically
  -- rather than half-dispatch.
  if (select count(*) from stock_transfer_items where transfer_id = v_transfer_id) <> array_length(p_serial_ids, 1) then
    raise exception 'serial_count_mismatch';
  end if;

  return v_transfer_id;
end;
$$;

revoke all on function dispatch_transfer(uuid, uuid, uuid[], uuid, text, text) from public, anon, authenticated;
grant execute on function dispatch_transfer(uuid, uuid, uuid[], uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- receive_transfer — resolves a subset of a transfer's still-in_transit lines
-- as either arrived (p_received) or lost (p_lost, each with a reason code).
-- Callable more than once on the same transfer for a genuine partial receipt
-- (8 of 10 today, the rest resolved later) — only touches lines still
-- 'in_transit'; already-resolved lines are left alone. Recomputes the header
-- status from the aggregate afterward.
--
-- p_lost shape: [{ "serial_id": "<uuid>", "reason_code": "<text>" }, ...]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function receive_transfer(
  p_transfer_id uuid,
  p_received    uuid[],
  p_lost        jsonb,
  p_actor_id    uuid,
  p_actor_role  text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer      stock_transfers%rowtype;
  v_serial        record;
  v_lost_entry    jsonb;
  v_adjustment_id uuid;
  v_remaining     int;
begin
  select * into v_transfer from stock_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'transfer_not_found';
  end if;
  if v_transfer.status <> 'in_transit' then
    raise exception 'transfer_not_in_transit';
  end if;
  -- A serial cannot both arrive and be declared lost in the same receipt.
  -- Reject the ambiguous payload before changing any line; duplicate/retry
  -- calls remain harmless because resolved lines are still ignored below.
  if exists (
    select 1
    from unnest(coalesce(p_received, '{}'::uuid[])) as received(serial_id)
    join jsonb_array_elements(coalesce(p_lost, '[]'::jsonb)) as lost(item)
      on received.serial_id = (lost.item->>'serial_id')::uuid
  ) then
    raise exception 'transfer_receive_conflict';
  end if;

  perform i.branch_id
  from   inventory i
  where  i.branch_id = v_transfer.to_branch_id
    and  i.product_id in (
      select product_id from product_serials
      where id in (select serial_id from stock_transfer_items where transfer_id = p_transfer_id)
    )
  order  by i.product_id
  for update of i;

  if p_received is not null and array_length(p_received, 1) > 0 then
    for v_serial in
      select sti.serial_id, ps.product_id
      from   stock_transfer_items sti
      join   product_serials ps on ps.id = sti.serial_id
      where  sti.transfer_id = p_transfer_id
        and  sti.serial_id = any(p_received)
        and  sti.status = 'in_transit'
      for update of ps
    loop
      update stock_transfer_items set status = 'received' where transfer_id = p_transfer_id and serial_id = v_serial.serial_id;
      update product_serials set status = 'in_stock', current_branch_id = v_transfer.to_branch_id where id = v_serial.serial_id;

      insert into stock_ledger (
        serial_id, product_id, movement_type, to_branch_id, reference_type, reference_id, actor_user_id, actor_role
      ) values (
        v_serial.serial_id, v_serial.product_id, 'transfer_in', v_transfer.to_branch_id, 'transfer', p_transfer_id, p_actor_id, p_actor_role
      );

      insert into inventory (product_id, branch_id, stock)
      values (v_serial.product_id, v_transfer.to_branch_id, 1)
      on conflict (product_id, branch_id) do update set stock = inventory.stock + 1, updated_at = now();
    end loop;
  end if;

  if p_lost is not null and jsonb_array_length(p_lost) > 0 then
    insert into stock_adjustments (branch_id, actor_user_id, notes)
    values (v_transfer.to_branch_id, p_actor_id, 'Lost in transit — transfer ' || v_transfer.transfer_number)
    returning id into v_adjustment_id;

    for v_lost_entry in select * from jsonb_array_elements(p_lost)
    loop
      select sti.serial_id, ps.product_id into v_serial
      from   stock_transfer_items sti
      join   product_serials ps on ps.id = sti.serial_id
      where  sti.transfer_id = p_transfer_id
        and  sti.serial_id = (v_lost_entry->>'serial_id')::uuid
        and  sti.status = 'in_transit'
      for update of ps;

      if not found then
        continue;
      end if;

      update stock_transfer_items set status = 'lost' where transfer_id = p_transfer_id and serial_id = v_serial.serial_id;
      update product_serials set status = 'written_off', current_branch_id = null where id = v_serial.serial_id;

      insert into stock_adjustment_items (adjustment_id, serial_id, reason_code, direction)
      values (v_adjustment_id, v_serial.serial_id, coalesce(v_lost_entry->>'reason_code', 'loss_theft'), 'remove');

      insert into stock_ledger (
        serial_id, product_id, movement_type, reference_type, reference_id, actor_user_id, actor_role
      ) values (
        v_serial.serial_id, v_serial.product_id, 'adjusted_out', 'transfer', p_transfer_id, p_actor_id, p_actor_role
      );
    end loop;
  end if;

  select count(*) into v_remaining from stock_transfer_items where transfer_id = p_transfer_id and status = 'in_transit';
  if v_remaining = 0 then
    update stock_transfers set status = 'received', received_at = now() where id = p_transfer_id;
  end if;
end;
$$;

revoke all on function receive_transfer(uuid, uuid[], jsonb, uuid, text) from public, anon, authenticated;
grant execute on function receive_transfer(uuid, uuid[], jsonb, uuid, text) to service_role;
