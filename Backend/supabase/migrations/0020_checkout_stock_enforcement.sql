-- ─────────────────────────────────────────────────────────────────────────────
-- 0020_checkout_stock_enforcement.sql
--
-- Closes audit finding F-02: checkout never consulted inventory, so every
-- product was infinitely purchasable regardless of what was on the shelf.
--
-- CONTEXT
--   `place_order` (0008) is otherwise the model of a correct checkout: it locks
--   the cart lines, recomputes every figure from live prices, validates the
--   promo, writes the order and its items, bumps promo usage and clears the
--   cart — all in one transaction. It simply never looked at `inventory`.
--   The table existed only as a manually-edited admin grid that no
--   customer-facing path read.
--
--   The consequence is orders the business cannot fulfil, on a platform where
--   cancelling a PAID order deliberately requires an explicit admin
--   acknowledgement (SPEC-06 R5) — so every oversell is expensive to unwind.
--
-- WHAT THIS CHANGES
--   `place_order` now, inside the same transaction:
--     1. Locks the relevant `inventory` rows.
--     2. Rejects the whole checkout if any line exceeds available stock.
--     3. Decrements stock across branches to cover each line.
--
-- DESIGN DECISIONS (and why)
--
--   CHECK-AND-REJECT, NOT RESERVE. A reservation model needs a hold table and
--   an expiry sweeper, and the sweeper is another unlocked cron job (F-05).
--   Deducting inside the existing transaction is atomic by construction and
--   adds no moving parts. The trade is that stock is only held once payment is
--   initiated, not while the customer fills the form — acceptable at this
--   volume, and revisitable without touching callers.
--
--   AGGREGATE ACROSS BRANCHES. `orders` has no fulfilment branch column, and
--   inventory is keyed (product_id, branch_id). Rather than invent a branch
--   allocation the business has not asked for, availability is the SUM across
--   active branches and the deduction walks branches deterministically
--   (most stock first, then branch id) until the line is covered. When the
--   business later designates a fulfilment branch, only `deduct_stock_fifo`
--   changes.
--
--   NO INVENTORY ROW MEANS ZERO. A product with no `inventory` rows is
--   unpurchasable rather than unlimited — the safe reading, and the one that
--   makes "stock it before you sell it" the explicit workflow. `seed.sql`
--   already cross-joins every product against every branch, so nothing in dev
--   or CI is affected. A `products` insert trigger below extends the same
--   guarantee to products created through the admin panel, which would
--   otherwise appear on the storefront permanently out of stock.
--
--   ORDERED LOCKING. Both the availability check and the deduction take rows in
--   (product_id, branch_id) order. Two concurrent checkouts holding overlapping
--   carts therefore acquire the same rows in the same sequence and queue rather
--   than deadlock.
--
-- SAFETY
--   Existing rows are untouched. The function is replaced, not dropped, so its
--   grants (service_role only, per 0010) survive.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── 1. New products get inventory rows at every active branch ───────────────
-- Stock starts at 0: visible in the admin grid, ready to be set, and correctly
-- unpurchasable until someone does.

create or replace function seed_inventory_for_new_product()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into inventory (product_id, branch_id, stock)
  select NEW.id, b.id, 0
  from   branches b
  where  b.is_active
  on conflict (product_id, branch_id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists products_seed_inventory on products;
create trigger products_seed_inventory
  after insert on products
  for each row
  execute function seed_inventory_for_new_product();

comment on function seed_inventory_for_new_product() is
  'Creates zero-stock inventory rows at every active branch for a new product, so it is visible in the admin grid and correctly unpurchasable until stocked (F-02).';

-- ─── 2. Deduct stock for one product across branches ─────────────────────────
-- Walks branches most-stocked-first and decrements until `p_qty` is covered.
-- Raises if it cannot be covered, which aborts the enclosing transaction.

create or replace function deduct_stock_fifo(
  p_product_id uuid,
  p_qty        int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_remaining int := p_qty;
  v_row       record;
  v_take      int;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN;
  END IF;

  -- Deterministic order so concurrent checkouts queue instead of deadlocking.
  FOR v_row IN
    SELECT i.branch_id, i.stock
    FROM   inventory i
    JOIN   branches b ON b.id = i.branch_id AND b.is_active
    WHERE  i.product_id = p_product_id
      AND  i.stock > 0
    ORDER  BY i.stock DESC, i.branch_id
    FOR UPDATE OF i
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := least(v_row.stock, v_remaining);

    UPDATE inventory
    SET    stock = stock - v_take,
           updated_at = now()
    WHERE  product_id = p_product_id
      AND  branch_id  = v_row.branch_id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    -- Belt and braces: place_order checks availability first, but a concurrent
    -- admin edit between the check and here would land us short. Raising aborts
    -- the whole checkout rather than shipping a partially-deducted order.
    RAISE EXCEPTION 'insufficient_stock';
  END IF;
END;
$$;

comment on function deduct_stock_fifo(uuid, int) is
  'Decrements inventory for one product across active branches, most-stocked first, in a deadlock-safe order. Raises insufficient_stock if it cannot be covered (F-02).';

-- ─── 3. place_order, now stock-aware ─────────────────────────────────────────

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
  -- ── Resolve the customer's cart ──
  SELECT id INTO v_cart_id
  FROM carts
  WHERE customer_id = p_customer_id;

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'Your cart is empty.';
  END IF;

  -- ── Lock cart_items rows before computing the subtotal ──
  -- H-5 FIX: PostgreSQL disallows FOR UPDATE with aggregate queries. Lock
  -- cart_items first via a separate SELECT, then compute the aggregate.
  -- This prevents a concurrent request (e.g. two checkout tabs) from modifying
  -- quantities between the subtotal read and the order INSERT.
  PERFORM id FROM cart_items WHERE cart_id = v_cart_id FOR UPDATE;

  -- ── F-02: lock the inventory rows this cart touches ──
  -- Taken in (product_id, branch_id) order, matching deduct_stock_fifo, so
  -- overlapping concurrent checkouts queue rather than deadlock. This lock is
  -- what makes the availability check below meaningful: without it two
  -- checkouts could both read "1 left" and both proceed.
  PERFORM i.product_id
  FROM   inventory i
  JOIN   branches b ON b.id = i.branch_id AND b.is_active
  WHERE  i.product_id IN (SELECT ci.product_id FROM cart_items ci WHERE ci.cart_id = v_cart_id)
  ORDER  BY i.product_id, i.branch_id
  FOR UPDATE OF i;

  -- ── F-02: reject the whole checkout if any line exceeds available stock ──
  -- Reports the first short line by name so the API can surface something the
  -- customer can act on, rather than a bare failure.
  SELECT p.name AS product_name,
         ci.quantity AS wanted,
         coalesce(s.available, 0) AS available
  INTO   v_short
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  LEFT JOIN LATERAL (
    SELECT sum(i.stock)::int AS available
    FROM   inventory i
    JOIN   branches b ON b.id = i.branch_id AND b.is_active
    WHERE  i.product_id = ci.product_id
  ) s ON true
  WHERE  ci.cart_id = v_cart_id
    AND  ci.quantity > coalesce(s.available, 0)
  ORDER  BY p.name
  LIMIT  1;

  IF FOUND THEN
    -- Message is parsed by OrdersService to build a 409 the storefront shows.
    RAISE EXCEPTION 'insufficient_stock:%:%:%',
      v_short.product_name, v_short.wanted, v_short.available;
  END IF;

  -- ── Subtotal over purchasable (active) lines, snapshotting live prices ──
  SELECT round(coalesce(sum(p.price_kes * ci.quantity), 0), 2)
  INTO   v_subtotal
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  WHERE  ci.cart_id = v_cart_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Your cart is empty or contains only unavailable products.';
  END IF;

  -- ── Validate + price the promo (no-op when none supplied) ──
  IF p_promo_code IS NOT NULL AND length(btrim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo
    FROM   promo_codes
    WHERE  code = btrim(p_promo_code)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promo code not found.';
    END IF;
    IF NOT v_promo.is_active THEN
      RAISE EXCEPTION 'This promo code is no longer active.';
    END IF;
    IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > v_now THEN
      RAISE EXCEPTION 'This promo code is not yet valid.';
    END IF;
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < v_now THEN
      RAISE EXCEPTION 'This promo code has expired.';
    END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.uses >= v_promo.max_uses THEN
      RAISE EXCEPTION 'This promo code has reached its usage limit.';
    END IF;

    -- Category-scoped codes only discount matching lines; global codes the whole subtotal.
    IF v_promo.category_id IS NULL THEN
      v_promo_base := v_subtotal;
    ELSE
      SELECT round(coalesce(sum(p.price_kes * ci.quantity), 0), 2)
      INTO   v_promo_base
      FROM   cart_items ci
      JOIN   products p ON p.id = ci.product_id AND p.is_active
      WHERE  ci.cart_id = v_cart_id
        AND  p.category_id = v_promo.category_id;
    END IF;

    IF v_promo_base <= 0 THEN
      RAISE EXCEPTION 'This promo code does not apply to any item in your cart.';
    END IF;

    -- percent → base·value/100 ; fixed → flat value. Clamp to [0, base].
    IF v_promo.discount_type = 'percent' THEN
      v_discount := round((v_promo_base * v_promo.value) / 100, 2);
    ELSE
      v_discount := round(v_promo.value, 2);
    END IF;
    v_discount := round(least(greatest(v_discount, 0), v_promo_base), 2);

    v_applied_code := v_promo.code;
  END IF;

  -- ── VAT on the post-discount taxable base; flat shipping ──
  v_taxable_base := round(v_subtotal - v_discount, 2);
  v_vat          := round(v_taxable_base * 0.16, 2);
  v_shipping     := CASE WHEN p_delivery_option = 'pickup' THEN 0 ELSE 300 END;
  v_total        := round(v_taxable_base + v_vat + v_shipping, 2);

  -- ── Initial status: COD enters the queue immediately; online waits on payment ──
  v_status := CASE WHEN p_payment_method = 'cod'
                   THEN 'received'::order_status
                   ELSE 'pending_payment'::order_status END;

  -- ── Insert the order (order_number from the generate_order_number() DEFAULT) ──
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

  -- ── Snapshot the lines into order_items (live unit price per line) ──
  INSERT INTO order_items (order_id, product_id, quantity, unit_price_kes, lens_option)
  SELECT v_order.id, ci.product_id, ci.quantity, p.price_kes, ci.lens_option
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  WHERE  ci.cart_id = v_cart_id;

  -- ── F-02: deduct the stock we verified above ──
  -- Aggregated per product first: the same product can appear on two cart lines
  -- with different lens options, and each must draw from the same pool.
  FOR v_line IN
    SELECT ci.product_id, sum(ci.quantity)::int AS qty
    FROM   cart_items ci
    JOIN   products p ON p.id = ci.product_id AND p.is_active
    WHERE  ci.cart_id = v_cart_id
    GROUP  BY ci.product_id
    ORDER  BY ci.product_id
  LOOP
    PERFORM deduct_stock_fifo(v_line.product_id, v_line.qty);
  END LOOP;

  -- ── Bump promo usage (atomic; only when a code actually applied) ──
  IF v_applied_code IS NOT NULL THEN
    PERFORM increment_promo_uses(v_applied_code);
  END IF;

  -- ── Clear the cart: drop the lines, null out the persisted promo ──
  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  UPDATE carts SET promo_code = NULL WHERE id = v_cart_id;

  RETURN v_order;
END;
$$;

-- ─── 4. Grants ───────────────────────────────────────────────────────────────
-- CREATE OR REPLACE preserves existing grants, but deduct_stock_fifo is new and
-- would otherwise inherit EXECUTE to PUBLIC — the exact hole 0010 closed for
-- place_order. Revoke first, then grant only service_role.

revoke execute on function public.deduct_stock_fifo(uuid, int) from public;
revoke execute on function public.deduct_stock_fifo(uuid, int) from anon;
revoke execute on function public.deduct_stock_fifo(uuid, int) from authenticated;
grant  execute on function public.deduct_stock_fifo(uuid, int) to service_role;

revoke execute on function public.seed_inventory_for_new_product() from public;
revoke execute on function public.seed_inventory_for_new_product() from anon;
revoke execute on function public.seed_inventory_for_new_product() from authenticated;
grant  execute on function public.seed_inventory_for_new_product() to service_role;

-- ─── 5. Backfill ─────────────────────────────────────────────────────────────
-- Any product created before this migration that has no inventory row would be
-- silently unpurchasable. Give them rows at zero so they surface in the admin
-- grid as needing stock, rather than disappearing from sale without explanation.

insert into inventory (product_id, branch_id, stock)
select p.id, b.id, 0
from   products p
cross  join branches b
where  b.is_active
  and  not exists (
    select 1 from inventory i
    where i.product_id = p.id and i.branch_id = b.id
  );
