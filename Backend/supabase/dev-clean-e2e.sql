-- Removes the artefacts that e2e runs leave behind in a LOCAL dev database.
--
-- Why this exists: the API e2e suite creates its own categories, products,
-- inventory movements, customers and orders and never tears them down. Run
-- against a long-lived Docker stack it accumulates until the test data
-- outnumbers the seed — at the time of writing, 331 of 346 products and 5 of
-- 10 categories — so the storefront's category row leads with "E2E Transfers"
-- and "ZZ Probe Category" and the real catalogue is buried.
--
-- `seed.sql` is clean. Nothing here is seeded; it is all runtime residue.
--
-- SAFETY
--   * Local development databases only. Never run this against a hosted
--     project — it deletes orders and payment transactions.
--   * One transaction: it either all applies or none of it does.
--   * Idempotent. A second run finds nothing and reports zeroes.
--   * Scoped by explicit name/slug patterns, never "everything that is not
--     seed data" — a customer's real order must survive a careless run.
--
-- Usage:
--   docker exec -i optex-supabase-db-1 psql -U postgres -d postgres \
--     < Backend/supabase/dev-clean-e2e.sql

begin;

create temporary table _e2e_categories on commit drop as
select id from categories
where slug like 'e2e-%' or slug like 'zz-%';

create temporary table _e2e_products on commit drop as
select id from products
where sku like 'E2E%'
   or name like 'E2E%'
   or name like 'ZZ%'
   or category_id in (select id from _e2e_categories);

-- Any order containing a test product is itself a test order. The suite never
-- mixes a seed product into one of its own checkouts.
create temporary table _e2e_orders on commit drop as
select distinct order_id as id
from order_items
where product_id in (select id from _e2e_products);

do $$
declare
  c_cat int; c_prod int; c_ord int;
begin
  select count(*) into c_cat from _e2e_categories;
  select count(*) into c_prod from _e2e_products;
  select count(*) into c_ord from _e2e_orders;
  raise notice 'Targeting % categories, % products, % orders', c_cat, c_prod, c_ord;
end $$;

-- ── Orders ────────────────────────────────────────────────────────────────
-- Payment rows are NO ACTION, so they must go first.
delete from mpesa_transactions   where order_id in (select id from _e2e_orders);
delete from pesapal_transactions where order_id in (select id from _e2e_orders);

-- A prescription is a clinical record. Detach it from the test order rather
-- than destroying it — the column is nullable and the upload still stands on
-- its own.
update prescriptions set order_id = null
where order_id in (select id from _e2e_orders);

-- order_items and order_cancellation_requests are ON DELETE CASCADE.
delete from orders where id in (select id from _e2e_orders);

-- ── Inventory movement (all RESTRICT — must precede products) ─────────────
-- Four tables reference product_serials, which is itself ON DELETE CASCADE
-- from products. So deleting a product fails on tables that never mention
-- products at all. Worse, their own product_id column is not a reliable
-- proxy: stock_transfer_items has none, and rows exist in the others whose
-- serial belongs to a test product while product_id does not. Clearing by
-- serial first, then by product, is what makes this terminate.
create temporary table _e2e_serials on commit drop as
select id from product_serials where product_id in (select id from _e2e_products);

delete from stock_transfer_items   where serial_id in (select id from _e2e_serials);
delete from stock_adjustment_items where serial_id in (select id from _e2e_serials);
delete from stock_count_items      where serial_id in (select id from _e2e_serials);
delete from stock_ledger           where serial_id in (select id from _e2e_serials);

delete from stock_ledger           where product_id in (select id from _e2e_products);
delete from stock_count_items      where product_id in (select id from _e2e_products);
delete from stock_adjustment_items where product_id in (select id from _e2e_products);
delete from goods_received_items   where product_id in (select id from _e2e_products);

-- ── Remaining direct references ───────────────────────────────────────────
-- cart_items is NO ACTION. inventory, product_reviews, product_serials and
-- wishlist_items are CASCADE and follow the product delete on their own.
delete from cart_items where product_id in (select id from _e2e_products);

delete from products   where id in (select id from _e2e_products);
delete from categories where id in (select id from _e2e_categories);

do $$
declare
  c_cat int; c_prod int;
begin
  select count(*) into c_cat  from categories;
  select count(*) into c_prod from products;
  raise notice 'Remaining: % categories, % products', c_cat, c_prod;
end $$;

commit;
