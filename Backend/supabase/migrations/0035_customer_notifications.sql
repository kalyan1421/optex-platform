-- 0035_customer_notifications.sql
--
-- Customer-facing notification feed: orders, appointments, and offers
-- (promo banners) in one inbox, so a customer has somewhere persistent to
-- see what's happened rather than only ever getting a one-off SMS/email.
create table customer_notifications (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  category    text not null check (category in ('order', 'appointment', 'offer')),
  title       text not null,
  body        text not null,
  -- In-app path the notification points at, e.g. /orders/<id>/tracking.
  -- Nullable: an 'offer' notification may just point at /shop.
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index customer_notifications_customer_idx on customer_notifications(customer_id, created_at desc);
create index customer_notifications_unread_idx on customer_notifications(customer_id) where read_at is null;

alter table customer_notifications enable row level security;

-- Same posture as wishlist_items (0017) / customer_addresses (0016): the
-- customer can read their own rows, but every write — including marking
-- one read — goes through the API's service-role client, explicitly
-- scoped to customer_id in code, never a customer-writable policy.
create policy "customer reads own notifications"
  on customer_notifications for select
  using (customer_id = current_customer_id() or is_super_admin());

-- Fan-out for the 'offer' category: one INSERT..SELECT, atomic, and cheap
-- even at thousands of rows — used instead of looping individual inserts
-- from the API when a promo banner goes live.
create or replace function notify_all_customers(
  p_category text,
  p_title text,
  p_body text,
  p_link text default null
) returns void
language sql
as $$
  insert into customer_notifications (customer_id, category, title, body, link)
  select id, p_category, p_title, p_body, p_link
  from customers
  where deactivated_at is null;
$$;
