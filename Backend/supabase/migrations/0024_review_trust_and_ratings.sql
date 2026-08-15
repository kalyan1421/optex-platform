-- ─────────────────────────────────────────────────────────────────────────────
-- 0024_review_trust_and_ratings.sql
--
-- Closes audit findings F-11 and F-12.
--
-- F-12 — ANY CUSTOMER COULD REVIEW ANY PRODUCT WITHOUT BUYING IT.
--   `createForProduct` resolved the caller's customers.id and enforced one
--   review per product, but never checked for an order containing it. There was
--   no verified-purchase flag on the row and none in the response, so the
--   storefront could not have displayed one even if the policy existed.
--   Moderation was the only defence, which made review volume an admin workload
--   problem as much as a trust one.
--
--   This adds `verified_purchase`, set by trigger at insert time rather than
--   computed on read: the answer is "did they own this when they wrote it",
--   which must not change later because an order was refunded or deleted.
--
--   NOT enforced as a hard requirement. The client has not asked to forbid
--   unverified reviews, and silently rejecting them would be a product decision
--   made in a migration. The flag is what lets the storefront show a badge and
--   lets an admin sort the moderation queue by it — policy stays a policy
--   question.
--
-- F-11 — RATINGS WERE INVISIBLE OUTSIDE THE PRODUCT PAGE.
--   The shop grid, search results, category pages and home carousels showed no
--   star rating and no review count, i.e. the strongest conversion signal in
--   eyewear retail was absent from every listing a customer actually browses.
--
--   That was not fixable in the UI alone: `products` had no aggregate, and the
--   list endpoint could not join one cheaply, so stars on a 24-item grid would
--   have meant 24 extra round-trips. This denormalises `rating_avg` and
--   `rating_count` onto `products`, maintained by trigger.
--
--   COUNTING ONLY APPROVED REVIEWS is what makes the trigger slightly fiddly —
--   a moderation status change (pending → approved, approved → flagged) moves
--   a review in or out of the aggregate, so the trigger fires on UPDATE too,
--   not only INSERT/DELETE.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── F-12 · verified purchase ────────────────────────────────────────────────

alter table product_reviews
  add column if not exists verified_purchase boolean not null default false;

comment on column product_reviews.verified_purchase is
  'True when the author had ordered this product at the time of writing. Set once by trigger; never recomputed (F-12).';

create or replace function set_review_verified_purchase()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Any non-cancelled order containing this product counts. Deliberately NOT
  -- restricted to 'delivered': frames are frequently collected in branch and
  -- the order is closed out later, so requiring delivery would mark genuine
  -- buyers unverified for reasons that have nothing to do with them.
  NEW.verified_purchase := exists (
    select 1
    from   order_items oi
    join   orders o on o.id = oi.order_id
    where  oi.product_id = NEW.product_id
      and  o.customer_id = NEW.customer_id
      and  o.status <> 'cancelled'
  );

  return NEW;
end;
$$;

drop trigger if exists product_reviews_verify_purchase on product_reviews;
create trigger product_reviews_verify_purchase
  before insert on product_reviews
  for each row
  execute function set_review_verified_purchase();

-- Backfill existing rows against the same rule.
update product_reviews r
set    verified_purchase = exists (
         select 1
         from   order_items oi
         join   orders o on o.id = oi.order_id
         where  oi.product_id = r.product_id
           and  o.customer_id = r.customer_id
           and  o.status <> 'cancelled'
       )
where  r.verified_purchase = false;

-- ─── F-11 · denormalised rating aggregate ────────────────────────────────────

alter table products
  add column if not exists rating_avg   numeric(2,1),
  add column if not exists rating_count int not null default 0;

comment on column products.rating_avg is
  'Mean of approved review ratings, one decimal. NULL when there are none. Maintained by trigger (F-11).';
comment on column products.rating_count is
  'Number of approved reviews. Maintained by trigger (F-11).';

create or replace function refresh_product_rating(p_product_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update products p
  set    rating_avg   = agg.avg_rating,
         rating_count = agg.n
  from (
    select round(avg(rating)::numeric, 1) as avg_rating,
           count(*)::int                  as n
    from   product_reviews
    where  product_id = p_product_id
      and  status = 'approved'
  ) agg
  where p.id = p_product_id;
end;
$$;

create or replace function product_reviews_touch_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Refresh both sides on UPDATE: a moderation change moves a review into or
  -- out of the aggregate, and product_id could in principle be corrected.
  if TG_OP in ('INSERT', 'UPDATE') then
    perform refresh_product_rating(NEW.product_id);
  end if;
  if TG_OP in ('UPDATE', 'DELETE') then
    if TG_OP = 'DELETE' or OLD.product_id is distinct from NEW.product_id then
      perform refresh_product_rating(OLD.product_id);
    end if;
  end if;

  return null; -- AFTER trigger; return value is ignored
end;
$$;

drop trigger if exists product_reviews_rating_sync on product_reviews;
create trigger product_reviews_rating_sync
  after insert or update or delete on product_reviews
  for each row
  execute function product_reviews_touch_rating();

-- Backfill every product that already has approved reviews.
update products p
set    rating_avg   = agg.avg_rating,
       rating_count = agg.n
from (
  select product_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int                  as n
  from   product_reviews
  where  status = 'approved'
  group  by product_id
) agg
where p.id = agg.product_id;

-- Sorting the catalogue by rating is the obvious next ask; index for it now.
create index if not exists products_rating_idx
  on products (rating_avg desc nulls last)
  where is_active;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.refresh_product_rating(uuid) from public;
revoke execute on function public.refresh_product_rating(uuid) from anon;
revoke execute on function public.refresh_product_rating(uuid) from authenticated;
grant  execute on function public.refresh_product_rating(uuid) to service_role;
