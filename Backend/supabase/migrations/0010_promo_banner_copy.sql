-- Migration 0010: promotional banner copy fields
-- ─────────────────────────────────────────────────────────────────────────────
-- The homepage promotional cards render a badge, a headline, a body paragraph
-- and a call-to-action label. `promo_banners` (migration 0001) only carried
-- image_url / target_url / headline, so the rest of the copy was hardcoded in
-- components/home/Promotional.jsx along with two Unsplash URLs — the banners
-- were not editable from the admin panel at all.
--
-- Adding the missing fields rather than dropping them from the design: the
-- storefront copy belongs in the database where Promotions admin can change it.
--
-- `accent` drives which of the two brand overlays a card uses, so the existing
-- red/blue alternating look survives without hardcoding it to card position.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

alter table promo_banners add column if not exists badge     text;
alter table promo_banners add column if not exists body      text;
alter table promo_banners add column if not exists cta_label text;
alter table promo_banners add column if not exists accent    text not null default 'dark'
  check (accent in ('dark', 'blue'));

-- Seed the two cards the homepage previously hardcoded, so the section renders
-- identically but is now admin-editable. Idempotent: keyed on image_url, and
-- only inserted when the table has no rows carrying the new copy fields yet.
insert into promo_banners (image_url, target_url, badge, headline, body, cta_label, accent, sort_order, is_active)
select v.image_url, v.target_url, v.badge, v.headline, v.body, v.cta_label, v.accent, v.sort_order, true
from (values
  ('https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1000&auto=format&fit=crop',
   '/category/sunglasses',
   'Limited Offer',
   'Buy 1 Get 1 Free on Winter Shades',
   'Protect your eyes in style with our latest polarized sunglasses. Offer ends this Sunday.',
   'Shop Now', 'dark', 1),
  ('https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop',
   '/shop',
   'New Collection',
   'Up to 30% Off Designer Frames',
   'Elevate your look with premium frames from Rayban, Oakley, and more at unbeatable prices.',
   'Explore Sale', 'blue', 2)
) as v(image_url, target_url, badge, headline, body, cta_label, accent, sort_order)
where not exists (select 1 from promo_banners where badge is not null);
