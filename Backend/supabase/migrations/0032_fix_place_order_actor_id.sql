-- Fix: place_order passed customers.id as deduct_stock_fifo's p_actor_id,
-- which is written straight into stock_ledger.actor_user_id --
-- `references auth.users(id)`, not customers(id) (customers has its own
-- independently-generated primary key; the FK back to auth.users is the
-- separate `auth_user_id` column). Every checkout with sufficient stock has
-- therefore been failing outright with a foreign-key violation since 0026
-- shipped -- the only checkouts that ever succeeded were ones that hit the
-- earlier 'insufficient_stock' exception first. Found by reproducing
-- stock.e2e-spec.ts's "deducts stock when checkout succeeds" against a
-- freshly migrated database.
--
-- Fix: resolve the caller's auth_user_id from customers before calling
-- deduct_stock_fifo. Rest of the function is unchanged from 0026.

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
