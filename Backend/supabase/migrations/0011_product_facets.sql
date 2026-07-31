-- Migration 0011: public product facets (stock + popularity)
-- ─────────────────────────────────────────────────────────────────────────────
-- The shop listing needs two things it could not previously get:
--
--   • "In stock only" — total stock across active branches, per product.
--   • "Sort by popularity" — units actually sold.
--
-- Units sold cannot be read from the storefront directly: RLS on `orders` and
-- `order_items` restricts a customer to their own rows (correctly), so a
-- client-side aggregate would only ever count that customer's purchases.
--
-- A view solves it. Postgres views run with the *owner's* privileges unless
-- declared `security_invoker = true`, so this one can aggregate across all
-- orders while exposing nothing but per-product counts — no customer ids, no
-- order ids, no amounts. Cancelled orders are excluded.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

create or replace view product_facets as
select
  p.id                                          as product_id,
  coalesce(stock.total_stock, 0)                as total_stock,
  coalesce(stock.total_stock, 0) > 0            as in_stock,
  coalesce(sold.units_sold, 0)                  as units_sold,
  coalesce(reviews.review_count, 0)             as review_count,
  reviews.average_rating
from products p
left join (
  select i.product_id, sum(i.stock)::bigint as total_stock
    from inventory i
    join branches b on b.id = i.branch_id and b.is_active
   group by i.product_id
) stock on stock.product_id = p.id
left join (
  select oi.product_id, sum(oi.quantity)::bigint as units_sold
    from order_items oi
    join orders o on o.id = oi.order_id
   where o.status <> 'cancelled'
   group by oi.product_id
) sold on sold.product_id = p.id
left join (
  select r.product_id,
         count(*)::bigint         as review_count,
         round(avg(r.rating), 2)  as average_rating
    from product_reviews r
   where r.status = 'approved'
   group by r.product_id
) reviews on reviews.product_id = p.id
where p.is_active;

comment on view product_facets is
  'Public per-product aggregates for storefront filtering and sorting. Exposes '
  'only counts — never customer, order or payment detail. Runs with owner '
  'privileges by design so it can aggregate across RLS-protected order rows.';

-- Explicitly NOT security_invoker: that is the whole point of the view.
alter view product_facets set (security_invoker = false);

grant select on product_facets to anon, authenticated;
