-- OPTEX Opticians — initial schema
-- SOW: OPTEX-SOW-2025-001-KE v3.0 (Kenya)
-- Aligned with Notion admin spec (13 screens) + customer storefront feature list.
-- All monetary fields are KES. Single super_admin role; customers via Supabase Auth.

set search_path = public;

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────

create type user_role     as enum ('super_admin', 'customer');
create type order_status  as enum ('pending_payment','received','processing','dispatched','delivered','cancelled');
create type payment_method as enum ('mpesa','pesapal','cod');
create type payment_status as enum ('pending','paid','failed','refunded');
create type appt_status   as enum ('pending','confirmed','rescheduled','cancelled','completed');
create type review_status as enum ('pending','approved','flagged');
create type pres_status   as enum ('pending','processed');
create type discount_kind as enum ('percent','fixed');

-- ─── Reference tables ───────────────────────────────────────────────────────

create table branches (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  address     text,
  phone       text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  hours       jsonb,                       -- {mon:{open,close}, tue:..., ...}
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  display_image text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ─── Catalog ────────────────────────────────────────────────────────────────

create table products (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  slug            text unique not null,
  name            text not null,
  category_id     uuid not null references categories(id) on delete restrict,
  brand           text,
  frame_material  text,
  frame_shape     text,                    -- round, square, aviator, cat-eye, ...
  gender          text,                    -- men, women, unisex, kids
  description     text,
  price_kes       numeric(10,2) not null check (price_kes >= 0),
  images          text[] not null default '{}',
  try_on_image_url text,                   -- Phase 3 transparent PNG (tryon-assets bucket)
  is_active       boolean not null default true,
  search_tsv      tsvector generated always as (
                    to_tsvector(
                      'simple',
                      coalesce(name,'') || ' ' ||
                      coalesce(brand,'') || ' ' ||
                      coalesce(sku,'')   || ' ' ||
                      coalesce(description,'')
                    )
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_search_idx   on products using gin(search_tsv);
create index products_category_idx on products(category_id) where is_active;
create index products_brand_idx    on products(brand)       where is_active;

create table inventory (
  product_id  uuid not null references products(id) on delete cascade,
  branch_id   uuid not null references branches(id) on delete cascade,
  stock       int  not null default 0 check (stock >= 0),
  updated_at  timestamptz not null default now(),
  primary key (product_id, branch_id)
);

-- ─── Customers ──────────────────────────────────────────────────────────────

create table customers (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  created_at    timestamptz not null default now()
);
create index customers_email_idx on customers(email);
create index customers_phone_idx on customers(phone);

-- ─── Orders ─────────────────────────────────────────────────────────────────

create table orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text unique not null,                 -- e.g. OPX-2026-000123
  customer_id     uuid references customers(id),
  branch_id       uuid references branches(id),         -- fulfilling branch
  subtotal_kes    numeric(10,2) not null,
  discount_kes    numeric(10,2) not null default 0,
  vat_kes         numeric(10,2) not null default 0,     -- 16% if VAT-registered
  shipping_kes    numeric(10,2) not null default 0,
  total_kes       numeric(10,2) not null,
  status          order_status   not null default 'pending_payment',
  payment_method  payment_method,
  payment_status  payment_status not null default 'pending',
  mpesa_ref       text,
  pesapal_id      text,
  promo_code      text,
  shipping        jsonb,                                 -- {name, phone, address, city, county, postal}
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index orders_customer_idx on orders(customer_id);
create index orders_status_idx   on orders(status);
create index orders_created_idx  on orders(created_at desc);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  product_id      uuid not null references products(id),
  quantity        int  not null check (quantity > 0),
  unit_price_kes  numeric(10,2) not null,
  lens_option     jsonb                                   -- {type:'single_vision', coatings:['blue_light']}
);
create index order_items_order_idx on order_items(order_id);

-- ─── Cart (server-side persistent) ──────────────────────────────────────────

create table carts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid unique references customers(id) on delete cascade,
  updated_at      timestamptz not null default now()
);

create table cart_items (
  id              uuid primary key default gen_random_uuid(),
  cart_id         uuid not null references carts(id) on delete cascade,
  product_id      uuid not null references products(id),
  quantity        int  not null check (quantity > 0),
  lens_option     jsonb,
  unique (cart_id, product_id, lens_option)
);

-- ─── Optical-specific ───────────────────────────────────────────────────────

create table appointments (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id),
  branch_id     uuid not null references branches(id),
  type          text not null,                           -- eye_test | frame_fitting | consultation
  scheduled_at  timestamptz not null,
  status        appt_status not null default 'pending',
  contact_name  text, contact_phone text,                -- for guest bookings
  notes         text,
  created_at    timestamptz not null default now()
);
create index appointments_scheduled_idx on appointments(scheduled_at);
create index appointments_branch_idx    on appointments(branch_id, scheduled_at);

create table prescriptions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id),
  order_id      uuid references orders(id),
  file_url      text,                                    -- prescriptions bucket (signed URL)
  sphere_od     numeric(4,2),  sphere_os numeric(4,2),
  cyl_od        numeric(4,2),  cyl_os    numeric(4,2),
  axis_od       int,           axis_os   int,
  pd            numeric(4,1),
  status        pres_status not null default 'pending',
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Reviews ────────────────────────────────────────────────────────────────

create table product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  customer_id   uuid not null references customers(id),
  rating        int not null check (rating between 1 and 5),
  body          text,
  status        review_status not null default 'pending',
  admin_reply   text,
  created_at    timestamptz not null default now()
);
create index reviews_product_idx on product_reviews(product_id) where status = 'approved';

-- ─── Promotions ─────────────────────────────────────────────────────────────

create table promo_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  discount_type  discount_kind not null,
  value          numeric(10,2) not null check (value > 0),
  category_id    uuid references categories(id),
  max_uses       int,
  uses           int not null default 0,
  starts_at      timestamptz,
  expires_at     timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table promo_banners (
  id            uuid primary key default gen_random_uuid(),
  image_url     text not null,                           -- promo-banners bucket
  target_url    text,
  headline      text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  sort_order    int not null default 0
);

-- ─── Payment logs ───────────────────────────────────────────────────────────

create table mpesa_transactions (
  id              uuid primary key default gen_random_uuid(),
  mpesa_ref       text unique not null,
  amount_kes      numeric(10,2) not null,
  customer_phone  text,
  order_id        uuid references orders(id),
  raw             jsonb,                                 -- full Daraja callback payload
  status          text not null default 'unmatched',    -- unmatched | matched | reversed
  received_at     timestamptz not null default now()
);
create index mpesa_status_idx on mpesa_transactions(status);

create table pesapal_transactions (
  id                uuid primary key default gen_random_uuid(),
  pesapal_order_id  text unique not null,
  amount_kes        numeric(10,2),
  method            text,                                -- visa | mastercard | airtel | bank
  order_id          uuid references orders(id),
  raw               jsonb,
  status            text,
  received_at       timestamptz not null default now()
);

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function is_super_admin()
returns boolean
language sql stable
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;

create or replace function current_customer_id()
returns uuid
language sql stable
as $$
  select id from customers where auth_user_id = auth.uid();
$$;

-- Auto-update `updated_at`
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_updated_at  before update on products  for each row execute function set_updated_at();
create trigger orders_updated_at    before update on orders    for each row execute function set_updated_at();
create trigger inventory_updated_at before update on inventory for each row execute function set_updated_at();
create trigger carts_updated_at     before update on carts     for each row execute function set_updated_at();

-- Sequence-backed human-readable order numbers (OPX-2026-000123)
create sequence order_number_seq start 1;
create or replace function generate_order_number()
returns text language sql as $$
  select 'OPX-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('order_number_seq')::text, 6, '0');
$$;
