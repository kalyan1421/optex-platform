-- Migration 0007: Security hardening — app_metadata role claim + atomic cart helper
-- ─────────────────────────────────────────────────────────────────────────────
-- C-1 / C-5 FIX: Move super_admin role check from user_metadata (user-writable)
-- to app_metadata (only writable via service-role Admin API).
-- Also adds SECURITY DEFINER + fixed search_path to prevent search-path injection.
--
-- C-4 FIX: Migrate existing super_admin users from user_metadata → app_metadata.
-- This runs automatically so no manual follow-up is needed.
-- The role is added to app_metadata and removed from user_metadata in one UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

-- C-4 FIX: Move role claim for any existing super_admin users to app_metadata.
-- Runs at migration time — no manual step required after deploy.
UPDATE auth.users
SET raw_app_meta_data  = raw_app_meta_data  || '{"role":"super_admin"}'::jsonb,
    raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ->> 'role' = 'super_admin';

-- ─────────────────────────────────────────────────────────────────────────────
-- H-6 FIX: Atomic cart item quantity increment.
-- Eliminates the read-modify-write race in addCartItem where two concurrent
-- requests both read quantity=N and both write N+1 instead of N+2.
-- Returns the updated cart_items row.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_cart_item_qty(
  item_id uuid,
  delta   integer
)
RETURNS SETOF cart_items
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE cart_items
  SET    quantity = quantity + delta
  WHERE  id = item_id
  RETURNING *;
$$;
