-- 0041_homepage_curation.sql
--
-- Gives the admin panel control over the three curated homepage sections.
--
-- WHAT WAS WRONG. "Trending Now", "Featured Products" and "Featured
-- Collection" were never curated. All three called the same public catalogue
-- listing and took the first N rows of `order by created_at desc`:
--
--   TrendingNow        listProducts({ limit: 4 })    -> the 4 newest products
--   FeaturedProducts   listProducts({ limit: 8 })    -> the 8 newest products
--   FeaturedCollection listProducts({ limit: 100 })  -> newest 100, tabbed by category
--
-- So "trending" and "featured" were both spelled "recently added", the two
-- sections showed overlapping products by construction (Trending's 4 are a
-- strict subset of Featured's 8), and nothing an admin could do changed either.
-- `products.service.ts` already carried the comment "`featured` has no
-- dedicated column yet, so it falls back to newest-first", and
-- `ProductSort.Featured` had been in the DTO enum unimplemented. This closes
-- both.
--
-- WHY FLAGS AND NOT A CURATION TABLE. A `homepage_sections` +
-- `section_products` pair would allow per-section ordering, scheduling and the
-- same product held in two sections at different positions — the shape
-- `promo_banners` already uses for the hero. It was considered and declined
-- for now: the admin product form is the surface staff already use, two
-- booleans drop straight into it, and no new API module or admin page is
-- needed. The cost is that a product carries one `homepage_sort` shared by
-- both sections rather than a position per section, and there is no
-- start/end scheduling. If either becomes a real requirement, the curation
-- table is the migration that replaces this, and these columns drop.
--
-- WHY THE READ PATH STILL FALLS BACK. Every flag defaults to false, so the
-- instant this migration applies, a strict `where is_featured` query returns
-- nothing and the homepage would render three empty sections on a live site.
-- The service therefore treats the flags as an OVERRIDE, not a filter: if any
-- product is flagged for a section it shows exactly those, and if none is it
-- keeps the previous newest-first behaviour. That makes this deployable with
-- no coordinated content entry, and makes un-flagging everything a safe way
-- back rather than a way to blank the page.
--
-- WHY homepage_sort IS NULLABLE WITH NO DEFAULT. Staff think in "put this
-- first", so a low number sorting first matches the mental model. The obvious
-- shape — `not null default 0` — is wrong, and was caught in testing: with
-- `order by homepage_sort asc`, every unpositioned product sits at 0 and
-- therefore outranks the curated ones at 1, 2, 3. That is invisible while a
-- section filters to flagged rows only (they are all curated), and it breaks
-- the sort=featured path, which orders the whole catalogue without filtering.
-- NULL means "no opinion" and sorts last, so positioning one product cannot
-- silently demote it below products nobody has touched.

alter table products
  add column if not exists is_featured   boolean not null default false,
  add column if not exists is_trending   boolean not null default false,
  add column if not exists homepage_sort int;

comment on column products.is_featured is
  'Pin to the homepage "Featured Products" section. When no product is flagged, that section falls back to newest-first.';
comment on column products.is_trending is
  'Pin to the homepage "Trending Now" section. When no product is flagged, that section falls back to newest-first.';
comment on column products.homepage_sort is
  'Position within a curated homepage section; ascending with NULLS LAST, ties broken by created_at desc. NULL means unpositioned. Shared by both sections.';

-- Partial indexes: these two queries are the homepage's hot path and both are
-- highly selective (a handful of flagged rows out of the whole catalogue), so
-- indexing only the flagged-and-active subset keeps them small.
create index if not exists products_featured_idx
  on products (homepage_sort nulls last, created_at desc)
  where is_active and is_featured;

create index if not exists products_trending_idx
  on products (homepage_sort nulls last, created_at desc)
  where is_active and is_trending;
