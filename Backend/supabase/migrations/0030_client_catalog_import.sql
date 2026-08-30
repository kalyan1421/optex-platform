-- Real client-provided product catalogue (Optex_Client_Input_Form_filled.xlsx,
-- OPTEX-SOW-2025-001-KE Section 1), replacing the 3 dev-placeholder products
-- seed.sql left in as a stand-in ("swap to real URLs once catalog spreadsheet is
-- delivered"). Reference images are sourced from the supplier site
-- (lens2cart.com) per the form itself -- real product photography is still
-- pending per the form's own photography question.
--
-- The form also collected MRP, cost price, and a per-row tax % (all 16%, i.e.
-- Kenya's standard VAT) and colour -- none of these have a column on `products`
-- (only a single `price_kes` selling price exists, tax is applied globally at
-- checkout, and there is no strikethrough/original-price or colour field yet).
-- Colour is folded into `name` so the three same-named SKUs stay distinguishable
-- in listings; MRP and cost price are dropped -- there is nowhere to put them.

-- `categories` is otherwise only populated by seed.sql, which migrate.sh runs
-- AFTER every numbered migration -- so on a genuinely fresh database (a new
-- environment, or CI's ephemeral runner) the category lookups below all
-- resolved to null and this migration failed outright on products.category_id
-- NOT NULL. Categories are reference/taxonomy data, not disposable dev
-- fixtures, so this migration seeds the rows it depends on itself rather than
-- relying on migration order it doesn't control. Matches seed.sql's values;
-- ON CONFLICT DO NOTHING makes seed.sql's later insert of the same rows a
-- no-op either way.
insert into categories (slug, name, sort_order) values
  ('eyeglasses',      'Eyeglasses',      1),
  ('sunglasses',      'Sunglasses',      2),
  ('kids',            'Kids',            3),
  ('computer-glasses','Computer Glasses',4),
  ('reading-glasses', 'Reading Glasses', 5)
on conflict (slug) do nothing;

with c as (select id, slug from categories)
insert into products (sku, slug, name, category_id, brand, frame_material, frame_shape, gender, description, price_kes, images, is_active)
values
  ('RD A10245-C4', 'full-rim-rectangle-classic-eyeglasses-brown', 'Full Rim Rectangle Classic Eyeglasses — Brown',
     (select id from c where slug = 'eyeglasses'),
     'Lens2cart', 'Acetate', 'Rectangle', 'unisex',
     'Rectangle frame in acetate, brown.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/RD_A10245_C4_1_db88994a-3935-43ea-9c86-aa2fd9671b21.png'], true),
  ('RDA10012-C4', 'full-rim-rectangle-classic-eyeglasses-brown-blue', 'Full Rim Rectangle Classic Eyeglasses — Brown/Blue',
     (select id from c where slug = 'eyeglasses'),
     'Lens2cart', 'Acetate', 'Rectangle', 'unisex',
     'Rectangle frame in acetate, brown/blue.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/RDA10012C4_1_19113c9a-3631-4734-88b6-2a996b17fa53.png'], true),
  ('RD R10167-C2', 'full-rim-rectangle-classic-eyeglasses-black', 'Full Rim Rectangle Classic Eyeglasses — Black',
     (select id from c where slug = 'eyeglasses'),
     'Lens2cart', 'Acetate', 'Rectangle', 'unisex',
     'Rectangle frame in acetate, black.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/RD_R10167_C2_1_2b68f377-4005-4186-87dd-ce21bdc53538.png'], true),
  ('CH A 10276-C4', 'full-rim-square-classic-sunglasses-peach', 'Full Rim Square Classic Sunglasses — Peach',
     (select id from c where slug = 'sunglasses'),
     'Lens2cart', 'Acetate', 'Square', 'unisex',
     'Square frame in acetate, peach.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/CH_A_10276_C4_1_85f0ca98-22d3-4883-83f4-b236bc682ef5.png'], true),
  ('M9011-C1', 'full-rim-cat-eye-classic-sunglasses-black-gold', 'Full Rim Cat Eye Classic Sunglasses — Black/Gold',
     (select id from c where slug = 'sunglasses'),
     'Lens2cart', 'Metal', 'Cat-Eye', 'women',
     'Cat-Eye frame in metal, black/gold.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/M9011_C1_1.png'], true),
  ('UM6223-C2', 'full-rim-round-classic-sunglasses-black-havana', 'Full Rim Round Classic Sunglasses — Black/Havana',
     (select id from c where slug = 'sunglasses'),
     'Lens2cart', 'Acetate', 'Round', 'unisex',
     'Round frame in acetate, black/havana.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/UM6223_C2_1.png'], true),
  ('RB8013-C7', 'full-rim-wayfarer-kids-eyeglasses-magneto-premium-transparent-orange-yellow', 'Full Rim Wayfarer Kids Eyeglasses (Magneto Premium) — Transparent Orange/Yellow',
     (select id from c where slug = 'kids'),
     'Lens2cart', 'TR90', 'Wayfarer', 'kids',
     'Wayfarer frame in tr90, transparent orange/yellow.',
     2500.00, array['https://lens2cart.com/cdn/shop/files/RB8013_C8_1.png'], true),
  ('RB8011-C4', 'full-rim-round-kids-eyeglasses-magneto-premium-transparent-purple', 'Full Rim Round Kids Eyeglasses (Magneto Premium) — Transparent Purple',
     (select id from c where slug = 'kids'),
     'Lens2cart', 'TR90', 'Round', 'kids',
     'Round frame in tr90, transparent purple.',
     2500.00, array['https://lens2cart.com/cdn/shop/files/RB8011_C4_1.png'], true),
  ('M5202-C2', 'full-rim-rectangle-kids-eyeglasses-adjustable-temples-matte-black-maroon', 'Full Rim Rectangle Kids Eyeglasses (Adjustable Temples) — Matte Black/Maroon',
     (select id from c where slug = 'kids'),
     'Lens2cart', 'TR90', 'Rectangle', 'kids',
     'Rectangle frame in tr90, matte black/maroon.',
     2500.00, array['https://lens2cart.com/cdn/shop/files/M5202_C-2_1.png'], true),
  ('A22905-C2', 'full-rim-cat-eye-classic-eyeglasses-red', 'Full Rim Cat Eye Classic Eyeglasses — Red',
     (select id from c where slug = 'computer-glasses'),
     'Lens2cart', 'Acetate', 'Cat-Eye', 'women',
     'Cat-Eye frame in acetate, red.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/A22905C2_1a52aae8-d71c-4d2d-8e56-2c75dde9ce3b.png'], true),
  ('A21807-C4', 'full-rim-round-classic-eyeglasses-havana-transparent-blue', 'Full Rim Round Classic Eyeglasses — Havana/Transparent Blue',
     (select id from c where slug = 'computer-glasses'),
     'Lens2cart', 'Acetate', 'Round', 'unisex',
     'Round frame in acetate, havana/transparent blue.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/A21807C2_1_4460670f-a560-4e56-b12b-636b653a4d31.png'], true),
  ('RD A10215-C3', 'full-rim-square-classic-eyeglasses-blue', 'Full Rim Square Classic Eyeglasses — Blue',
     (select id from c where slug = 'computer-glasses'),
     'Lens2cart', 'Acetate', 'Square', 'unisex',
     'Square frame in acetate, blue.',
     3500.00, array['https://lens2cart.com/cdn/shop/files/RDA10215C3_1.png'], true)

on conflict (sku) do update set
  slug            = excluded.slug,
  name            = excluded.name,
  category_id     = excluded.category_id,
  brand           = excluded.brand,
  frame_material  = excluded.frame_material,
  frame_shape     = excluded.frame_shape,
  gender          = excluded.gender,
  description     = excluded.description,
  price_kes       = excluded.price_kes,
  images          = excluded.images,
  updated_at      = now();
