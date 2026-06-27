-- Performance indexes for common admin and storefront queries.
-- All are created concurrently to avoid locking on busy tables.

-- orders: payment status filter used in payment reconciliation views
create index if not exists orders_payment_status_idx
  on orders(payment_status);

-- orders: customer lookup (profile page order history)
create index if not exists orders_customer_id_idx
  on orders(customer_id);

-- cart_items: cart lookup (already has cart_id FK but an explicit index helps)
create index if not exists cart_items_cart_id_idx
  on cart_items(cart_id);

-- appointments: customer lookup
create index if not exists appointments_customer_id_idx
  on appointments(customer_id);

-- prescriptions: customer lookup + status filter
create index if not exists prescriptions_customer_id_idx
  on prescriptions(customer_id);
create index if not exists prescriptions_status_idx
  on prescriptions(status);

-- product_reviews: customer lookup + status filter (admin moderation)
create index if not exists product_reviews_customer_id_idx
  on product_reviews(customer_id);
create index if not exists product_reviews_status_idx
  on product_reviews(status);

-- promo_codes: active + expiry filter used at checkout validation
create index if not exists promo_codes_active_expires_idx
  on promo_codes(is_active, expires_at);

-- inventory: branch filter (admin inventory views by branch)
create index if not exists inventory_branch_id_idx
  on inventory(branch_id);
