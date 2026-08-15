-- 0017_wishlist_items.sql
--
-- Wishlist / favourites (SPEC-10 R1).
--
-- A plain join table — no separate parent "wishlist" entity per customer is
-- needed, and the composite primary key IS the idempotency guarantee R2
-- asks for ("saving an already-saved product is a no-op, not a conflict"):
-- an upsert with ON CONFLICT DO NOTHING on this key can never create a
-- second row for the same (customer, product) pair, even under the
-- same-product-from-two-tabs race SPEC-10's edge cases call out.
create table wishlist_items (
  customer_id uuid not null references customers(id) on delete cascade,
  product_id  uuid not null references products(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create index wishlist_items_product_idx on wishlist_items(product_id);

alter table wishlist_items enable row level security;

-- Same posture 0009_rls_write_lockdown.sql established for cart/cart_items,
-- and customer_addresses (0016) already shipped with: a customer can read
-- their own rows, but every write goes through the API (service-role
-- client, explicitly scoped to customer_id in code) rather than a
-- customer-writable policy.
create policy "customer reads own wishlist"
  on wishlist_items for select
  using (customer_id = current_customer_id() or is_super_admin());
