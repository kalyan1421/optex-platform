-- 0006_security_fixes.sql
-- Critical security and schema fixes identified in backend audit

-- 1. Rewrite current_customer_id() with SECURITY DEFINER
-- Without SECURITY DEFINER, the function runs as the calling user.
-- If the customers SELECT policy ever changes, it silently returns NULL,
-- breaking RLS on orders, cart, appointments, prescriptions without error.
CREATE OR REPLACE FUNCTION current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM customers WHERE auth_user_id = auth.uid();
$$;

-- 2. Fix orders INSERT RLS — prevent customers from self-setting payment status
-- Currently a customer can INSERT an order with status='delivered' + payment_status='paid'
-- bypassing the entire payment flow.
DROP POLICY IF EXISTS "customer creates own order" ON orders;
CREATE POLICY "customer creates own order"
  ON orders FOR INSERT
  WITH CHECK (
    customer_id = current_customer_id()
    AND status = 'pending_payment'
    AND payment_status = 'pending'
  );

-- 3. Add DEFAULT to order_number column
-- Column is NOT NULL but has no DEFAULT — any INSERT that omits order_number crashes.
ALTER TABLE orders
  ALTER COLUMN order_number SET DEFAULT generate_order_number();

-- 4. Make orders.customer_id NOT NULL
-- No guest checkout exists in the SOW. NULL customer_id creates RLS lockout risks.
-- Must handle existing NULL rows first (there should be none in a fresh DB).
UPDATE orders SET customer_id = (
  SELECT id FROM customers LIMIT 1
) WHERE customer_id IS NULL;
ALTER TABLE orders ALTER COLUMN customer_id SET NOT NULL;

-- 5. Make prescriptions.customer_id NOT NULL
-- Same issue — NULL customer_id causes RLS lockout via NULL = uuid = FALSE.
UPDATE prescriptions SET customer_id = (
  SELECT id FROM customers LIMIT 1
) WHERE customer_id IS NULL;
ALTER TABLE prescriptions ALTER COLUMN customer_id SET NOT NULL;

-- 6. Add UNIQUE constraint on product_reviews (product_id, customer_id)
-- Prevents a customer from submitting unlimited reviews for the same product.
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'one_review_per_customer_product'
  ) THEN
    ALTER TABLE product_reviews
      ADD CONSTRAINT one_review_per_customer_product
      UNIQUE (product_id, customer_id);
  END IF;
END $$;

-- 7. Fix pesapal_transactions.status — add NOT NULL + default
-- Currently nullable, causing silent NULL rows from IPN callbacks that omit status.
ALTER TABLE pesapal_transactions
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'unmatched';

-- 8. Add missing indexes for FK columns without index coverage
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments(status);

-- 9. Add customer UPDATE/DELETE policies for appointments (self-service)
-- Postgres has no CREATE POLICY IF NOT EXISTS; drop-then-create is idempotent.
DROP POLICY IF EXISTS "customer updates own appt" ON appointments;
CREATE POLICY "customer updates own appt"
  ON appointments FOR UPDATE
  USING (customer_id = current_customer_id())
  WITH CHECK (customer_id = current_customer_id());

DROP POLICY IF EXISTS "customer cancels own appt" ON appointments;
CREATE POLICY "customer cancels own appt"
  ON appointments FOR DELETE
  USING (customer_id = current_customer_id());

-- 10. Fix inventory SELECT policy — only expose active products/branches
DROP POLICY IF EXISTS "inventory readable" ON inventory;
CREATE POLICY "inventory readable"
  ON inventory FOR SELECT
  USING (
    is_super_admin()
    OR (
      EXISTS (SELECT 1 FROM products p WHERE p.id = inventory.product_id AND p.is_active)
      AND EXISTS (SELECT 1 FROM branches b WHERE b.id = inventory.branch_id AND b.is_active)
    )
  );
