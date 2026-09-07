-- 0039_orders_fulfilling_branch.sql
--
-- Populates `orders.branch_id`, which has existed since 0001 and has never
-- held a value.
--
-- THE BUG THIS FIXES. Three admin surfaces are branch-scoped through this
-- column — the order list, order detail/cancel, and the whole cancellation-
-- request workflow. Their scoping code is correct and tested, and it filters
-- on a column that is always NULL, so a Branch Manager or Branch Staff member
-- sees *no orders and no cancellation requests at all*. Verified against the
-- dev database before this migration: 8 orders, 0 with a branch.
--
-- WHY IT WAS EMPTY. 0020 deliberately declined to "invent a branch allocation
-- the business has not asked for" and aggregated stock across branches instead;
-- 0026 preserved that when it rewrote deduct_stock_fifo. That was the right
-- call at the time — there was nothing to derive an answer from.
--
-- WHAT CHANGED. 0026 introduced `stock_ledger`, which records one append-only
-- row per unit per movement, and deduct_stock_fifo writes
-- ('sold', from_branch_id, 'order_item', order_item_id) for every unit it
-- consumes. So "which branch shipped this order" stopped being a policy
-- question and became a fact already in the data. This migration reads that
-- fact; it does not decide anything the ledger has not already recorded.
--
-- THE ONE JUDGEMENT CALL. An order whose lines came from more than one branch
-- has more than one supplier, and `orders.branch_id` is a single column. The
-- branch that supplied the MOST units wins, ties broken by branch id so the
-- result is deterministic and re-runnable. The consequence is worth stating
-- plainly: for a split order, the minority branch does not see it in its
-- queue. Modelling every contributing branch would mean a join table and a
-- rewrite of all three scoping call sites; that is a bigger change than the
-- bug warrants, and this column's own 0001 comment ("fulfilling branch")
-- reads as singular.
--
-- Cancellation does NOT clear the stamp. Restocking appends `sale_reversed`
-- rows and leaves the `sold` rows in place, so the branch that shipped an
-- order remains the branch that shipped it, and a cancelled order stays
-- visible to the branch that has to deal with it.

-- ─────────────────────────────────────────────────────────────────────────────
-- Derivation, as a function so place_order, the backfill below, and any later
-- reconciliation all agree by construction rather than by three copies of the
-- same query drifting apart.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function order_fulfilling_branch(p_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  SELECT sl.from_branch_id
  FROM   stock_ledger sl
  JOIN   order_items oi ON oi.id = sl.reference_id
  WHERE  sl.reference_type = 'order_item'
    AND  sl.movement_type  = 'sold'
    AND  sl.from_branch_id IS NOT NULL
    AND  oi.order_id = p_order_id
  GROUP  BY sl.from_branch_id
  ORDER  BY count(*) DESC, sl.from_branch_id
  LIMIT  1;
$$;

comment on function order_fulfilling_branch(uuid) is
  'The branch that supplied the most units of an order, read from stock_ledger''s sold movements. NULL when nothing was deducted through the ledger (an order predating 0026, or one whose lines were never stock-tracked) — callers must treat NULL as "unknown", never as "no branch".';

revoke all on function order_fulfilling_branch(uuid) from public, anon, authenticated;
grant execute on function order_fulfilling_branch(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- place_order — identical to 0032 apart from the branch stamp after the
-- deduction loop.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_auth_user_id uuid;
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
  v_branch_id    uuid;
BEGIN
  SELECT c.id, cu.auth_user_id INTO v_cart_id, v_auth_user_id
  FROM carts c
  JOIN customers cu ON cu.id = p_customer_id
  WHERE c.customer_id = p_customer_id;
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
    PERFORM deduct_stock_fifo(v_line.product_id, v_line.qty, v_line.order_item_id, v_auth_user_id, 'customer');
  END LOOP;

  -- Stamp the fulfilling branch now that the stock movements exist. This reads
  -- back what deduct_stock_fifo just wrote rather than deciding anything: the
  -- ledger already records, per unit, which branch it left.
  v_branch_id := order_fulfilling_branch(v_order.id);
  IF v_branch_id IS NOT NULL THEN
    UPDATE orders SET branch_id = v_branch_id, updated_at = now()
    WHERE  id = v_order.id
    RETURNING * INTO v_order;
  END IF;

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
-- Backfill + index
-- ─────────────────────────────────────────────────────────────────────────────

-- Only touches rows that are still NULL, so re-running is a no-op and an order
-- whose branch was set by hand is never overwritten.
update orders o
set    branch_id = order_fulfilling_branch(o.id)
where  o.branch_id is null
  and  order_fulfilling_branch(o.id) is not null;

-- The three scoped surfaces all filter on this column and there has never been
-- an index on it — it was harmless while every value was NULL.
create index if not exists orders_branch_idx on orders(branch_id, created_at desc);
