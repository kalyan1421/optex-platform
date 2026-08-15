-- 0016_customer_addresses.sql
--
-- Saved addresses / address book.
--
-- `orders.shipping` is a jsonb snapshot captured once per order — there was
-- nowhere to persist an address across orders, so checkout asked for the
-- full address every single time. Column names deliberately match
-- `ShippingAddressDto` exactly (name, phone, address, city, county, postal)
-- so a saved row maps onto the checkout payload with no field translation.
create table customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  label        text,
  name         text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  county       text not null,
  postal       text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index customer_addresses_customer_idx on customer_addresses(customer_id);

-- At most one default per customer, enforced at the database level rather
-- than by the application unsetting-then-setting — the latter has a race
-- window where two concurrent "set default" calls can both succeed and
-- leave two rows marked default.
create unique index customer_addresses_one_default_per_customer
  on customer_addresses (customer_id)
  where is_default;

create trigger customer_addresses_updated_at
  before update on customer_addresses
  for each row execute function set_updated_at();

alter table customer_addresses enable row level security;

-- Same posture 0009_rls_write_lockdown.sql established for cart/cart_items:
-- a customer can read their own rows, but every write goes through the API
-- (service-role client, which bypasses RLS and scopes to customer_id in
-- code) rather than through a customer-writable policy. This table ships
-- with that posture from the start rather than needing a follow-up
-- lockdown migration.
create policy "customer reads own addresses"
  on customer_addresses for select
  using (customer_id = current_customer_id() or is_super_admin());
