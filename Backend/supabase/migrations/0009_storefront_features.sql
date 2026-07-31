-- Migration 0009: storefront feature tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Backing tables for the customer-website features that had UI intent but no
-- schema: wishlist, saved addresses, notifications, review moderation extras
-- (edit/delete/helpful votes/verified purchase), promo minimum-order and
-- one-time-per-customer usage, and tokenised saved cards.
--
-- Conventions follow 0001-0008: uuid PKs via gen_random_uuid(), timestamptz,
-- RLS on every customer-owned table using current_customer_id() / is_super_admin()
-- (both SECURITY DEFINER with a locked search_path, see 0006/0007).
--
-- PCI NOTE: `saved_cards` deliberately stores NO primary account number and NO
-- CVV. It holds the gateway's token plus the display-only fragments (brand,
-- last four, expiry) needed to render "Visa •••• 4242". Card data itself never
-- touches this database — Pesapal holds it against the token. Storing a PAN
-- here would pull the whole platform into PCI-DSS scope.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── Wishlist ───────────────────────────────────────────────────────────────

create table if not exists wishlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id  uuid not null references products(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  constraint one_wishlist_row_per_product unique (customer_id, product_id)
);
create index if not exists wishlists_customer_idx on wishlists(customer_id);
create index if not exists wishlists_product_idx  on wishlists(product_id);

alter table wishlists enable row level security;

drop policy if exists "wishlist self only" on wishlists;
create policy "wishlist self only" on wishlists
  for all
  using      (customer_id = current_customer_id() or is_super_admin())
  with check (customer_id = current_customer_id());

-- ─── Saved addresses ────────────────────────────────────────────────────────

create table if not exists customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label       text,                       -- "Home", "Office"
  full_name   text not null,
  phone       text not null,
  address     text not null,
  city        text not null,
  county      text,
  postal_code text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists customer_addresses_customer_idx on customer_addresses(customer_id);

-- At most one default per customer. A partial unique index expresses this
-- directly, so the rule cannot be broken by a concurrent write the way a
-- check-then-set in application code can.
create unique index if not exists customer_addresses_one_default_idx
  on customer_addresses(customer_id) where is_default;

create trigger customer_addresses_updated_at
  before update on customer_addresses
  for each row execute function set_updated_at();

alter table customer_addresses enable row level security;

drop policy if exists "address self only" on customer_addresses;
create policy "address self only" on customer_addresses
  for all
  using      (customer_id = current_customer_id() or is_super_admin())
  with check (customer_id = current_customer_id());

-- ─── Notifications ──────────────────────────────────────────────────────────

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  type        text not null check (type in ('order','appointment','promo','account','system')),
  title       text not null,
  body        text,
  link        text,                       -- in-app destination, e.g. /orders/<id>/tracking
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_customer_idx
  on notifications(customer_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications(customer_id) where read_at is null;

alter table notifications enable row level security;

-- Customers may read their own and mark them read, but never author them:
-- notifications are written by the API with the service-role key.
drop policy if exists "notifications readable by owner" on notifications;
create policy "notifications readable by owner" on notifications
  for select using (customer_id = current_customer_id() or is_super_admin());

drop policy if exists "notifications markable by owner" on notifications;
create policy "notifications markable by owner" on notifications
  for update
  using      (customer_id = current_customer_id())
  with check (customer_id = current_customer_id());

-- ─── Reviews: edit, delete, helpful votes, verified purchase ────────────────

alter table product_reviews add column if not exists updated_at timestamptz;
alter table product_reviews add column if not exists verified_purchase boolean not null default false;

drop trigger if exists product_reviews_updated_at on product_reviews;
create trigger product_reviews_updated_at
  before update on product_reviews
  for each row execute function set_updated_at();

/*
  Verified-purchase badge.

  Set at insert time rather than computed on read: it records whether the
  customer had actually bought the product *when they reviewed it*, which is
  what the badge claims. Recomputing later would let a refunded or deleted
  order silently revoke a badge on an existing review.

  'cancelled' orders do not count. Payment status is not required — a COD order
  in the fulfilment queue is a real purchase.
*/
create or replace function set_review_verified_purchase()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.verified_purchase := exists (
    select 1
      from order_items oi
      join orders o on o.id = oi.order_id
     where oi.product_id = new.product_id
       and o.customer_id = new.customer_id
       and o.status <> 'cancelled'
  );
  return new;
end;
$$;

drop trigger if exists product_reviews_verified on product_reviews;
create trigger product_reviews_verified
  before insert on product_reviews
  for each row execute function set_review_verified_purchase();

-- Backfill the flag for reviews that predate this migration.
update product_reviews r
   set verified_purchase = exists (
         select 1
           from order_items oi
           join orders o on o.id = oi.order_id
          where oi.product_id = r.product_id
            and o.customer_id = r.customer_id
            and o.status <> 'cancelled'
       )
 where verified_purchase is distinct from true;

create table if not exists review_helpful_votes (
  review_id   uuid not null references product_reviews(id) on delete cascade,
  customer_id uuid not null references customers(id)       on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, customer_id)
);
create index if not exists review_helpful_votes_review_idx on review_helpful_votes(review_id);

alter table review_helpful_votes enable row level security;

drop policy if exists "helpful votes readable" on review_helpful_votes;
create policy "helpful votes readable" on review_helpful_votes
  for select using (true);

drop policy if exists "helpful vote self only" on review_helpful_votes;
create policy "helpful vote self only" on review_helpful_votes
  for all
  using      (customer_id = current_customer_id() or is_super_admin())
  with check (customer_id = current_customer_id());

-- Customers may edit and withdraw their own review. Moderation state stays with
-- the admin: an edit must not let the author flip their own review to
-- 'approved', so the status is forced back to 'pending' on any content change.
create or replace function reset_review_status_on_edit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.rating is distinct from old.rating) or (new.body is distinct from old.body) then
    if new.status is not distinct from old.status then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists product_reviews_reset_status on product_reviews;
create trigger product_reviews_reset_status
  before update on product_reviews
  for each row execute function reset_review_status_on_edit();

drop policy if exists "customer edits own review" on product_reviews;
create policy "customer edits own review" on product_reviews
  for update
  using      (customer_id = current_customer_id())
  with check (customer_id = current_customer_id());

drop policy if exists "customer deletes own review" on product_reviews;
create policy "customer deletes own review" on product_reviews
  for delete using (customer_id = current_customer_id());

-- ─── Promotions: minimum order + one redemption per customer ────────────────

alter table promo_codes add column if not exists min_order_kes numeric(10,2)
  check (min_order_kes is null or min_order_kes >= 0);
alter table promo_codes add column if not exists once_per_customer boolean not null default false;

create table if not exists promo_redemptions (
  id            uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  customer_id   uuid not null references customers(id)   on delete cascade,
  order_id      uuid references orders(id) on delete set null,
  redeemed_at   timestamptz not null default now(),
  constraint one_redemption_per_customer unique (promo_code_id, customer_id)
);
create index if not exists promo_redemptions_customer_idx on promo_redemptions(customer_id);

alter table promo_redemptions enable row level security;

drop policy if exists "redemptions readable by owner" on promo_redemptions;
create policy "redemptions readable by owner" on promo_redemptions
  for select using (customer_id = current_customer_id() or is_super_admin());

-- ─── Saved cards (tokens only — see the PCI note at the top) ────────────────

create table if not exists saved_cards (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  gateway       text not null default 'pesapal' check (gateway in ('pesapal')),
  gateway_token text not null,             -- opaque token; NOT a card number
  brand         text,                      -- visa | mastercard | amex
  last_four     text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  exp_month     int  check (exp_month between 1 and 12),
  exp_year      int  check (exp_year between 2024 and 2100),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint one_token_per_customer unique (customer_id, gateway, gateway_token)
);
create index if not exists saved_cards_customer_idx on saved_cards(customer_id);
create unique index if not exists saved_cards_one_default_idx
  on saved_cards(customer_id) where is_default;

alter table saved_cards enable row level security;

drop policy if exists "cards self only" on saved_cards;
create policy "cards self only" on saved_cards
  for all
  using      (customer_id = current_customer_id() or is_super_admin())
  with check (customer_id = current_customer_id());

-- ─── Grants ─────────────────────────────────────────────────────────────────
-- RLS above is what actually constrains rows; these grants just let the
-- authenticated role reach the tables at all. anon gets read-only on the two
-- public-facing bits (helpful-vote counts render for logged-out visitors).

grant select, insert, update, delete on wishlists, customer_addresses,
  review_helpful_votes, saved_cards to authenticated;
grant select, update on notifications to authenticated;
grant select on promo_redemptions to authenticated;
grant select on review_helpful_votes to anon;
