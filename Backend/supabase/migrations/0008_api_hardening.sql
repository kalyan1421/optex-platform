-- Migration 0008: API hardening (Linear AKS-160)
-- ─────────────────────────────────────────────────────────────────────────────
-- Five DB-hardening items flagged during the OPTEX NestJS API build. These move
-- behaviour that the API currently does best-effort / in-process down into the
-- database so it is durable, atomic, and server-authoritative:
--
--   1. carts.promo_code            — persist the applied promo (was an in-memory
--                                    Map in CartService.appliedPromos).
--   2. appointments reminder flags — let the cron reminder job mark which
--                                    reminders have already been sent (idempotent).
--   3. unique review index         — hard duplicate-review guard at the DB.
--   4. increment_promo_uses()      — atomic promo usage bump (was a racy
--                                    read-modify-write in OrdersService).
--   5. place_order()               — atomic checkout in a single transaction
--                                    (replaces the best-effort + compensation
--                                    sequence in OrdersService.checkout).
--
-- Money math in place_order() mirrors OrdersService.checkout / CartService EXACTLY:
--   subtotal = Σ price_kes·qty
--   discount = promo applied to subtotal (global) or to matching-category line
--              total (category-scoped), clamped to [0, base], rounded to 2dp
--   vat      = round((subtotal − discount) × 0.16, 2)   -- Kenya standard VAT 16%
--   shipping = 300 KES for delivery, 0 for pickup
--   total    = round((subtotal − discount) + vat + shipping, 2)
--
-- Convention notes: SECURITY DEFINER + locked search_path on all functions, to
-- match is_super_admin() / current_customer_id() / increment_cart_item_qty()
-- (migrations 0006, 0007). IF NOT EXISTS guards where sensible.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Persist the applied promo code on the cart.
--    CartService currently holds this in a process-memory Map (not durable across
--    restarts / instances). A nullable text column lets apply/clear/get persist it.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE carts ADD COLUMN IF NOT EXISTS promo_code text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Appointment reminder dispatch flags.
--    The CronModule reminder job (24h-before / 1h-before) needs idempotent "sent"
--    markers so a re-run does not double-send. Default false; NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean NOT NULL DEFAULT false;
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_1h_sent  boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Hard duplicate-review guard: one review per (product, customer).
--    NOTE: migration 0006 already adds an equivalent UNIQUE *constraint*
--    (one_review_per_customer_product) on the same columns. This index is the
--    belt-and-suspenders form requested in AKS-160; it is created IF NOT EXISTS
--    and will simply be redundant where 0006 succeeded. Either way it will FAIL
--    if duplicate (product_id, customer_id) rows already exist — DEDUPE FIRST,
--    e.g.:
--      DELETE FROM product_reviews a USING product_reviews b
--      WHERE a.product_id = b.product_id AND a.customer_id = b.customer_id
--        AND a.ctid < b.ctid;
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_product_customer_uidx
  ON product_reviews (product_id, customer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Atomic promo usage increment.
--    Replaces OrdersService.incrementPromoUses (a racy SELECT uses → UPDATE
--    uses+1). The WHERE clause only bumps codes still under their cap (NULL
--    max_uses = uncapped). Returns the new usage count, or NULL if the code was
--    not found or already at its cap (caller treats NULL as "not incremented").
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_promo_uses(p_code text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE promo_codes
  SET    uses = uses + 1
  WHERE  code = p_code
    AND  (max_uses IS NULL OR uses < max_uses)
  RETURNING uses;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Atomic checkout — place_order().
--    A single function body runs in one implicit transaction, so the order insert
--    + order_items insert + promo bump + cart clear either all commit or all roll
--    back. This replaces the multi-call best-effort + compensation sequence in
--    OrdersService.checkout. Returns the new orders row.
--
--    Mirrors the API money math (see header). Promo validation matches
--    CartService/OrdersService: is_active, starts_at/expires_at window,
--    uses < max_uses, optional category_id scoping; discount clamped to [0, base].
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants. Mirror the existing helpers: the service-role path (NestJS API) and
-- authenticated callers may execute these. increment_cart_item_qty (0007) is
-- effectively callable by both via the default PUBLIC grant; we are explicit here.
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION increment_promo_uses(text)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION place_order(uuid, text, jsonb, text, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLLOW-UP WIRING (separate task — not done here):
--   • OrdersModule.checkout()        → call the place_order(...) RPC instead of
--                                       the insert-order / insert-items /
--                                       compensation sequence; pass the resolved
--                                       customers.id, payment method, shipping
--                                       jsonb, deliveryOption, promoCode.
--   • CartModule (CartService)       → replace the in-memory appliedPromos Map
--                                       with reads/writes of carts.promo_code.
--   • Checkout + PromotionsModule    → use the increment_promo_uses(p_code) RPC
--                                       in place of the read-modify-write bump.
--   • CronModule (reminder job)      → filter on / set appointments.reminder_24h_sent
--                                       and reminder_1h_sent for idempotent sends.
-- ─────────────────────────────────────────────────────────────────────────────
