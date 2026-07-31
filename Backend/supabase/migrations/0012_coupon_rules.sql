-- Migration 0012: enforce the remaining coupon rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0009 added `promo_codes.min_order_kes` and `once_per_customer`, and
-- created `promo_redemptions` — but nothing read them. place_order() still
-- validated only is_active / date window / usage cap / category scope, so both
-- rules were decorative: a customer could reuse a "one per customer" code
-- indefinitely and could redeem a code below its minimum spend.
--
-- This redefines place_order() with those two checks added, and records a row
-- in promo_redemptions inside the same transaction so the once-per-customer
-- rule has something to test against on the next order.
--
-- Everything else — the money math, the status rules, the cart clear — is
-- carried over from 0008 unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

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
  v_promo_id     uuid := NULL;
  v_promo_base   numeric(10,2) := 0;
  v_discount     numeric(10,2) := 0;
  v_taxable_base numeric(10,2);
  v_vat          numeric(10,2);
  v_shipping     numeric(10,2);
  v_total        numeric(10,2);
  v_status       order_status;
  v_order        orders%ROWTYPE;
  v_now          timestamptz := now();
BEGIN
  SELECT id INTO v_cart_id FROM carts WHERE customer_id = p_customer_id;
  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'Your cart is empty.';
  END IF;

  PERFORM id FROM cart_items WHERE cart_id = v_cart_id FOR UPDATE;

  SELECT round(coalesce(sum(p.price_kes * ci.quantity), 0), 2)
  INTO   v_subtotal
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  WHERE  ci.cart_id = v_cart_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Your cart is empty or contains only unavailable products.';
  END IF;

  IF p_promo_code IS NOT NULL AND length(btrim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM promo_codes WHERE code = btrim(p_promo_code) FOR UPDATE;

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

    -- NEW: minimum order value, tested against the pre-discount subtotal.
    IF v_promo.min_order_kes IS NOT NULL AND v_subtotal < v_promo.min_order_kes THEN
      RAISE EXCEPTION 'This promo code requires a minimum order of KES %.',
        trim(to_char(v_promo.min_order_kes, 'FM999999990.00'));
    END IF;

    -- NEW: one redemption per customer, ever.
    IF v_promo.once_per_customer AND EXISTS (
      SELECT 1 FROM promo_redemptions
       WHERE promo_code_id = v_promo.id AND customer_id = p_customer_id
    ) THEN
      RAISE EXCEPTION 'You have already used this promo code.';
    END IF;

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

    IF v_promo.discount_type = 'percent' THEN
      v_discount := round((v_promo_base * v_promo.value) / 100, 2);
    ELSE
      v_discount := round(v_promo.value, 2);
    END IF;
    v_discount := round(least(greatest(v_discount, 0), v_promo_base), 2);

    v_applied_code := v_promo.code;
    v_promo_id     := v_promo.id;
  END IF;

  v_taxable_base := round(v_subtotal - v_discount, 2);
  v_vat          := round(v_taxable_base * 0.16, 2);
  v_shipping     := CASE WHEN p_delivery_option = 'pickup' THEN 0 ELSE 300 END;
  v_total        := round(v_taxable_base + v_vat + v_shipping, 2);

  v_status := CASE WHEN p_payment_method = 'cod'
                   THEN 'received'::order_status
                   ELSE 'pending_payment'::order_status END;

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
  FROM   cart_items ci
  JOIN   products p ON p.id = ci.product_id AND p.is_active
  WHERE  ci.cart_id = v_cart_id;

  IF v_applied_code IS NOT NULL THEN
    PERFORM increment_promo_uses(v_applied_code);

    -- Recorded for every code, not just once_per_customer ones: it is the
    -- audit trail of who redeemed what, and makes the rule enforceable if the
    -- flag is switched on later. ON CONFLICT keeps a repeat redemption of a
    -- normal code from aborting the checkout.
    INSERT INTO promo_redemptions (promo_code_id, customer_id, order_id)
    VALUES (v_promo_id, p_customer_id, v_order.id)
    ON CONFLICT (promo_code_id, customer_id) DO NOTHING;
  END IF;

  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  UPDATE carts SET promo_code = NULL WHERE id = v_cart_id;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(uuid, text, jsonb, text, text) TO authenticated, service_role;
