-- ─────────────────────────────────────────────────────────────────────────────
-- 0033_stock_count_reconcile_cache.sql
--
-- Makes `accept_stock_count` DERIVE the inventory cache from the serials it
-- just corrected, instead of adjusting it by ±1 per outcome.
--
-- THE BUG THIS REMOVES
--   Each of the function's three outcomes moved `inventory.stock` by one:
--   `stock = stock - 1` for a written-off serial, a -1/+1 pair for a
--   relocation, `+1` for a newly found unit. Every one of those assumes the
--   cache already agreed with `product_serials`. Where it did not, a write-off
--   drove the row below zero and `inventory_stock_check` aborted the whole
--   accept -- surfacing as a 500 with the count left `in_progress`, its
--   ledger rows and adjustments already written.
--
-- WHY DERIVE RATHER THAN CLAMP
--   `greatest(stock - 1, 0)` would have silenced the constraint and left the
--   cache wrong, which is the worst outcome for a module whose entire point is
--   per-serial auditability -- a wrong number nobody is told about.
--
--   Deriving is also the semantically right instrument HERE specifically. A
--   physical stock count is the one operation whose purpose is "the shelf is
--   the truth, correct the books". An incremental ±1 presumes the books were
--   already right, which is precisely what a count exists to stop presuming.
--   Recomputing also makes the function self-correcting: whatever drift
--   existed at the counted branch is gone once a count is accepted, and a
--   re-run converges instead of compounding.
--
-- SCOPE
--   Only `accept_stock_count` changes. `post_grn`, `deduct_stock_fifo`,
--   transfers and adjustments keep their incremental writes -- each of those
--   knows exactly which serials it moved, and none is a reconciliation.
--   Making `inventory.stock` a derived view everywhere is a bigger question
--   (it is read on storefront availability paths) and is not this migration.
--
-- Numbered 0033 rather than 0031: 0031 and 0032 are taken by work in flight.
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

  end loop;

  -- ── Reconcile the inventory cache from the serials ────────────────────────
  -- The three loops above no longer touch `inventory` incrementally. They set
  -- `product_serials` -- the cache that `stock_ledger` backs -- and the count
  -- per (product, branch) is then DERIVED from it here.
  --
  -- Affected pairs are the union of three sets, and all three are needed:
  --   * the counted products at this count's own branch;
  --   * wherever those products' serials sit now (outcome 2 relocates a serial
  --     INTO this branch from another, so the other branch's count drops);
  --   * every branch that already holds an inventory row for those products,
  --     which is what lets a row fall to 0 -- a branch whose last serial was
  --     just written off has no surviving serial to rediscover it by.
  insert into inventory (product_id, branch_id, stock)
  with counted_products as (
    select distinct coalesce(ps.product_id, sci.product_id) as product_id
    from   stock_count_items sci
    left join product_serials ps on ps.id = sci.serial_id
    where  sci.count_id = p_count_id
      and  coalesce(ps.product_id, sci.product_id) is not null
  ),
  affected as (
    select cp.product_id, v_count.branch_id as branch_id from counted_products cp
    union
    select ps.product_id, ps.current_branch_id
    from   product_serials ps
    join   counted_products cp on cp.product_id = ps.product_id
    where  ps.current_branch_id is not null
    union
    select i.product_id, i.branch_id
    from   inventory i
    join   counted_products cp on cp.product_id = i.product_id
  )
  select a.product_id,
         a.branch_id,
         (select count(*)
          from   product_serials ps
          where  ps.product_id        = a.product_id
            and  ps.current_branch_id = a.branch_id
            and  ps.status            = 'in_stock')
  from   affected a
  on conflict (product_id, branch_id) do update
    set stock = excluded.stock, updated_at = now();

  update stock_counts set status = 'completed', completed_at = now() where id = p_count_id;
end;
$$;

revoke all on function accept_stock_count(uuid, uuid, text) from public, anon, authenticated;
grant execute on function accept_stock_count(uuid, uuid, text) to service_role;
