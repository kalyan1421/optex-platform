-- ─────────────────────────────────────────────────────────────────────────────
-- 0034_cart_qty_bounds.sql
--
-- Bound what `increment_cart_item_qty` will accept.
--
-- The function took any `delta` and wrote `quantity + delta` unconditionally.
-- It is SECURITY DEFINER, so the row-level rules do not apply to it, and the
-- only thing standing between a caller and an arbitrary quantity was the DTO
-- on the API route in front of it. A quantity of 10,000 — or a negative one —
-- reached `cart_items` intact, and from there the order totals computed from
-- it.
--
-- Now the UPDATE matches no row unless the step is sane (-100..100) and the
-- result lands in 1..100, the same ceiling `AddCartItemDto` enforces. A
-- rejected call returns no row rather than raising, which is what the caller
-- already treats as "not applied".
--
-- WHY A NEW MIGRATION RATHER THAN EDITING 0007
--   The function is defined in 0007_security_meta.sql and editing it there is
--   the obvious-looking move — but `docker/migrate.sh` records applied
--   filenames in `_docker.migrations` and skips them on re-run, and hosted
--   Supabase tracks by filename too. An edit to 0007 therefore reaches only
--   databases that have never applied it: a fresh local stack picks it up, and
--   every existing environment — including production — silently does not.
--   `CREATE OR REPLACE` in a new file reaches all of them.
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
    AND  delta BETWEEN -100 AND 100
    AND  quantity + delta BETWEEN 1 AND 100
  RETURNING *;
$$;

-- Re-assert 0031's lockdown: CREATE OR REPLACE resets nothing here, but the
-- grant belongs beside the definition so a future replace cannot quietly widen
-- it.
REVOKE ALL ON FUNCTION increment_cart_item_qty(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_cart_item_qty(uuid, integer) TO service_role;
