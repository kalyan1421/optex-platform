-- OPTEX — Row Level Security policies
-- Anon (public website): read active products/categories/branches/promo banners + approved reviews.
-- Authenticated customer: manage own customer row, cart, orders, prescriptions, appointments, reviews.
-- super_admin (role claim in JWT user_metadata): full access to everything.
-- Service role (server-side webhooks): bypasses RLS by default — used for Daraja/Pesapal IPN writes.

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

alter table branches             enable row level security;
alter table categories           enable row level security;
alter table products             enable row level security;
alter table inventory            enable row level security;
alter table customers            enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table carts                enable row level security;
alter table cart_items           enable row level security;
alter table appointments         enable row level security;
alter table prescriptions        enable row level security;
alter table product_reviews      enable row level security;
alter table promo_codes          enable row level security;
alter table promo_banners        enable row level security;
alter table mpesa_transactions   enable row level security;
alter table pesapal_transactions enable row level security;

-- ─── Catalog: public read of active rows ────────────────────────────────────

create policy "branches readable"
  on branches for select using (is_active or is_super_admin());

create policy "categories readable"
  on categories for select using (true);

create policy "products readable"
  on products for select using (is_active or is_super_admin());

create policy "inventory readable"
  on inventory for select using (true);

create policy "approved banners readable"
  on promo_banners for select using (is_active or is_super_admin());

-- Admin writes only
create policy "admin writes branches"   on branches   for all using (is_super_admin()) with check (is_super_admin());
create policy "admin writes categories" on categories for all using (is_super_admin()) with check (is_super_admin());
create policy "admin writes products"   on products   for all using (is_super_admin()) with check (is_super_admin());
create policy "admin writes inventory"  on inventory  for all using (is_super_admin()) with check (is_super_admin());
create policy "admin writes banners"    on promo_banners for all using (is_super_admin()) with check (is_super_admin());
create policy "admin writes promos"     on promo_codes for all using (is_super_admin()) with check (is_super_admin());

create policy "promos: validate at checkout"
  on promo_codes for select using (
    is_active and (expires_at is null or expires_at > now())
    and (max_uses is null or uses < max_uses)
  );

-- ─── Customers ──────────────────────────────────────────────────────────────

create policy "customers see self"
  on customers for select using (auth_user_id = auth.uid() or is_super_admin());

create policy "customers update self"
  on customers for update using (auth_user_id = auth.uid())
                          with check (auth_user_id = auth.uid());

create policy "customers insert self"
  on customers for insert with check (auth_user_id = auth.uid());

create policy "admin manages customers"
  on customers for all using (is_super_admin()) with check (is_super_admin());

-- ─── Orders + items ─────────────────────────────────────────────────────────

create policy "customer reads own orders"
  on orders for select using (customer_id = current_customer_id() or is_super_admin());

create policy "customer creates own order"
  on orders for insert with check (customer_id = current_customer_id());

create policy "admin manages orders"
  on orders for all using (is_super_admin()) with check (is_super_admin());

create policy "customer reads own order items"
  on order_items for select using (
    exists (select 1 from orders o
              where o.id = order_items.order_id
                and (o.customer_id = current_customer_id() or is_super_admin()))
  );

create policy "customer inserts own order items"
  on order_items for insert with check (
    exists (select 1 from orders o
              where o.id = order_items.order_id
                and o.customer_id = current_customer_id())
  );

create policy "admin manages order items"
  on order_items for all using (is_super_admin()) with check (is_super_admin());

-- ─── Cart ───────────────────────────────────────────────────────────────────

create policy "cart self only"
  on carts for all
  using      (customer_id = current_customer_id() or is_super_admin())
  with check (customer_id = current_customer_id() or is_super_admin());

create policy "cart items self only"
  on cart_items for all
  using (
    exists (select 1 from carts c
              where c.id = cart_items.cart_id
                and (c.customer_id = current_customer_id() or is_super_admin()))
  )
  with check (
    exists (select 1 from carts c
              where c.id = cart_items.cart_id
                and c.customer_id = current_customer_id())
  );

-- ─── Appointments ───────────────────────────────────────────────────────────

create policy "customer reads own appts"
  on appointments for select using (customer_id = current_customer_id() or is_super_admin());

create policy "anyone can book appt"   -- guest bookings allowed (contact_name/phone)
  on appointments for insert with check (
    customer_id = current_customer_id() or customer_id is null
  );

create policy "admin manages appts"
  on appointments for all using (is_super_admin()) with check (is_super_admin());

-- ─── Prescriptions ──────────────────────────────────────────────────────────

create policy "customer reads own scripts"
  on prescriptions for select using (customer_id = current_customer_id() or is_super_admin());

create policy "customer uploads own script"
  on prescriptions for insert with check (customer_id = current_customer_id());

create policy "admin manages scripts"
  on prescriptions for all using (is_super_admin()) with check (is_super_admin());

-- ─── Reviews ────────────────────────────────────────────────────────────────

create policy "public reads approved reviews"
  on product_reviews for select using (status = 'approved' or customer_id = current_customer_id() or is_super_admin());

create policy "customer submits own review"
  on product_reviews for insert with check (customer_id = current_customer_id());

create policy "admin moderates reviews"
  on product_reviews for all using (is_super_admin()) with check (is_super_admin());

-- ─── Payment logs (admin-only; webhooks use service role to bypass RLS) ─────

create policy "admin reads mpesa log"
  on mpesa_transactions for all using (is_super_admin()) with check (is_super_admin());

create policy "admin reads pesapal log"
  on pesapal_transactions for all using (is_super_admin()) with check (is_super_admin());
