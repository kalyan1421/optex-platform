-- OPTEX — seed data for dev environments
-- Branches per Notion admin spec, categories per SOW, a handful of placeholder products.

insert into branches (slug, name, address, phone, lat, lng, hours, breaks, is_active) values
  ('nairobi-cbd',    'Nairobi CBD',    'Tom Mboya Street, Nairobi',   '+254 700 000 001',
     -1.286389, 36.817223,
     '{"mon":["09:00","18:00"],"tue":["09:00","18:00"],"wed":["09:00","18:00"],"thu":["09:00","18:00"],"fri":["09:00","18:00"],"sat":["10:00","16:00"],"sun":null}',
     '{"mon":["13:00","14:00"],"tue":["13:00","14:00"],"wed":["13:00","14:00"],"thu":["13:00","14:00"],"fri":["13:00","14:00"],"sat":null,"sun":null}',
     true),
  ('westlands',      'Westlands',      'Sarit Centre, Westlands',     '+254 700 000 002',
     -1.265430, 36.802826,
     '{"mon":["09:00","19:00"],"tue":["09:00","19:00"],"wed":["09:00","19:00"],"thu":["09:00","19:00"],"fri":["09:00","19:00"],"sat":["10:00","18:00"],"sun":["11:00","16:00"]}',
     '{"mon":["13:00","14:00"],"tue":["13:00","14:00"],"wed":["13:00","14:00"],"thu":["13:00","14:00"],"fri":["13:00","14:00"],"sat":null,"sun":null}',
     true),
  ('mombasa-road',   'Mombasa Road',   'T-Mall, Mombasa Road',        '+254 700 000 003',
     -1.319000, 36.831000,
     '{"mon":["10:00","20:00"],"tue":["10:00","20:00"],"wed":["10:00","20:00"],"thu":["10:00","20:00"],"fri":["10:00","20:00"],"sat":["10:00","20:00"],"sun":["11:00","18:00"]}',
     null,
     true)
on conflict (slug) do nothing;

insert into categories (slug, name, sort_order) values
  ('eyeglasses',      'Eyeglasses',      1),
  ('sunglasses',      'Sunglasses',      2),
  ('kids',            'Kids',            3),
  ('computer-glasses','Computer Glasses',4),
  ('reading-glasses', 'Reading Glasses', 5)
on conflict (slug) do nothing;

-- Three placeholder products to mirror current optex-web/CartContext seed.
-- Image URLs intentionally use a /seed/ path under product-images bucket;
-- swap to real URLs once catalog spreadsheet is delivered.

with c as (select id, slug from categories)
insert into products (sku, slug, name, category_id, brand, frame_material, frame_shape, gender, description, price_kes, images, is_active) values
  ('OPX-EXEC-PRO',    'executive-pro',     'Executive Pro',
     (select id from c where slug = 'eyeglasses'),
     'Optex',  'Acetate', 'Rectangle', 'unisex',
     'Premium acetate frame with blue-light filtering option.',
     32000.00, array['/seed/executive_pro.png'],   true),
  ('OPX-AVT-CLASSIC', 'classic-aviator',   'Classic Aviator',
     (select id from c where slug = 'sunglasses'),
     'Optex',  'Metal',   'Aviator',   'unisex',
     'Timeless aviator silhouette in brushed gold with UV400 lenses.',
     24000.00, array['/seed/classic_aviator.png'], true),
  ('OPX-RTRO-ROUND',  'retro-round',       'Retro Round',
     (select id from c where slug = 'eyeglasses'),
     'Optex',  'Acetate', 'Round',     'unisex',
     'Retro round in tortoiseshell with gradient grey lenses.',
     26000.00, array['/seed/retro_round.png'],     true)
on conflict (sku) do nothing;

-- Per-branch starting stock (10 units per branch).
insert into inventory (product_id, branch_id, stock)
select p.id, b.id, 10
  from products p cross join branches b
on conflict do nothing;

-- Super admin user.
--
-- !! LOCAL DEV SEED ONLY. The credentials below (admin@gmail.com / admin@123)
-- !! are weak by design for convenience and are committed in a git repo, so
-- !! treat them as public. NEVER run this seed against staging or production,
-- !! and never reuse this password there — create prod admins with a generated
-- !! password via the Auth Admin API (COMMANDS.md §10) instead.
--
-- C-1 FIX: role is stored in raw_app_meta_data (only writable via service-role
-- Admin API) rather than raw_user_meta_data (user-writable). Any existing seed
-- or prod user still on user_metadata must run the migration 0007 data fix.
-- The auth.users table is managed by GoTrue; we insert directly for local dev seeds.
-- NOTE: GoTrue scans its token columns as non-nullable Go strings, so they must
-- be '' (empty), NOT NULL — leaving them NULL causes a login-time
-- "Database error querying schema" (Scan error converting NULL to string).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@gmail.com',
  extensions.crypt('admin@123', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"full_name": "Optex Admin"}'::jsonb,
  '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
  false,
  '', '', '', '', '', '', '', ''
) on conflict (id) do nothing;

-- `provider_id` is NOT NULL with no default in current GoTrue; the unique
-- constraint is on (provider, provider_id), so conflict-target must match.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'email', 'admin@gmail.com'),
  'email',
  now(), now(), now()
) on conflict (provider, provider_id) do nothing;

-- Backfill customers row for the super_admin (trigger handles future signups)
insert into public.customers (auth_user_id, full_name, email)
select id, raw_user_meta_data->>'full_name', email
from auth.users
on conflict (auth_user_id) do nothing;
