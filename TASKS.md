# TASKS — OPTEX

**Owner:** Kalyan (solo) · **Capacity:** ~6 build points per 2-week sprint (1 pt ≈ 1 focused engineer-day)
**Sources:** [docs/FEATURE-STATUS.md](docs/FEATURE-STATUS.md) · [docs/DESIGN-STATUS.md](docs/DESIGN-STATUS.md) · [docs/SPRINT-01.md](docs/SPRINT-01.md) · [docs/ROADMAP.md](docs/ROADMAP.md)

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Now — Sprint 1 (2026-08-11 → 08-22) · "Make it safe"

**All five P0 items landed 2026-08-12**, verified against the running stack.

- [x] **CI pipeline** · `.github/workflows/ci.yml` — two jobs. `static`: typecheck, build, prettier. `e2e`: brings up the Docker Supabase stack, migrates, runs the API suite
- [x] **Close the unguarded M-Pesa credit path** (C-1) · a success callback with no usable amount is now refused and recorded as `amount_missing` instead of falling through to crediting the order
- [x] **PostgREST injection fix** (C-2) · `checkoutRequestId` is charset-checked before any query, and both lookups moved from an interpolated `.or()` to parameterised `.eq()`
- [x] **Migration `0010`** (C-3) · `place_order` and `increment_promo_uses` revoked from `public`, `anon` and `authenticated`; `service_role` keeps EXECUTE
- [x] **Reject COD server-side** · removed from `CheckoutPaymentMethod` so `@IsEnum` rejects it, with a service-level backstop, and removed from the checkout UI. Admin COD views stay — historical orders must remain readable
- [x] **Payment regression tests** · `apps/api/test/payments.e2e-spec.ts`, 6 cases covering all three defects plus the genuine-payment happy path

Found and fixed along the way — **the repo's only test suite had never run**:

- [x] `jest-e2e.json` pointed at `../tsconfig.json`, which resolved to a file that does not exist
- [x] No test tsconfig, so `describe`/`it`/`expect` were untyped
- [x] The spec asserted `/api/catalog/products` and `/api/catalog/categories`; the real routes are `/api/products` and `/api/categories`

Still open from the original sprint:

- [ ] **Smoke suite: shop → PDP → cart → checkout** · 3 pts · the browser-level suite. Still the hard prerequisite for Wave 4 / C3

## 1. Storefront — Catalogue & Discovery

The full plan for FEATURE-STATUS §1. Sequenced so each phase leaves the storefront shippable.

### Shipped this session

- [x] **Filter — price range** · 5 bands, `f03d809`
- [x] **Filter — frame shape** · `f03d809`
- [x] **Filter — gender** · `f03d809`, self-hides (all seed products are `unisex`)
- [x] **Filter — frame material** · `f03d809`, case-insensitive grouping
- [x] **Sort control** · featured / price ↑↓ / name, fills the empty 918×36 slot the design leaves
- [x] **Clear-all-filters control** · `f03d809`
- [x] **Fix `frame_shape || 'Sunglasses'` fallback** · was labelling eyeglasses as sunglasses

### C1 — Finish the Shop surface · ~4 pts · **DONE 2026-08-11** (except the Figma sync)

- [x] **Shop empty state** · two copy branches — an empty catalogue reads "Our collection is being updated", a zero-result filter reads "Try widening your search", with a Clear-all action. The sidebar hides entirely when the catalogue itself is empty, since every facet would read (0)
- [x] **Shop pagination** · 12/page (4 rows of the design's 3-up grid), numbered pages + Prev/Next, `Showing 13–24 of 24`, resets to page 1 on any filter change, clamps rather than trusting `page`
- [x] **Facet counts per option** · all six facets, computed **excluding their own selection** so "Round (6)" means what you would get by picking Round given the other filters
- [x] **Zero-count options disabled** · not in the original plan. A `(0)` row could only ever lead to the empty state; the active selection stays clickable so it can be switched away from
- [x] **Categories + Brands moved onto `FacetBlock`** · they were duplicated markup; all six facets now share one implementation
- [ ] **Draw the 6 facets + sort + pagination into Figma `0:1835`** · 0 pts (design) · **the file now lags the code in seven places.** Trace from the running page; pattern is 250px block, hairline rule, 40px rows, `#2E3192` active
- [!] **Decide the catalogue import shape** · blocked on client · 27 branches of real stock; the seed has 4 products. Every estimate below assumes a real catalogue lands

### C2 — Discovery · ~7 pts · **build DONE 2026-08-11** (designs still owed)

- [x] **Search autocomplete** · debounced 250ms, min 2 chars, 6 suggestions with image/brand/price, full keyboard nav (↑↓ wrap, Enter opens the highlighted product, Escape closes), "See all results for X" footer, outside-click close, and a monotonic request id so a slow early response cannot overwrite a fast later one
- [x] **Nav search input** · was **already built** — the overlay, input and submit-to-`/search` existed. Only the autocomplete was missing, so this cost nothing
- [x] **Share the filter sidebar with `/search`** · extracted `components/shop/ProductFilters.jsx` — `useProductFacets`, `ProductFilterSidebar`, `SortSelect`, `Pagination`, `sortProducts`. `/shop` dropped from 496 to 264 lines
- [x] **Facets narrow within the result set on `/search`** · header reads "1 result for X (filtered from 3)". Categories is not passed, so that facet does not render there
- [ ] **Design `/search`** · 0 pts (design) · now built against the Shop pattern rather than a spec — worth a designer pass
- [ ] **Design `/category/[slug]`** · 0 pts (design) · hero, description, grid. Must render without client JS — it is the only Server Component
- [ ] **Sync the Figma nav variants** · 0 pts (design) · 4 variants with no documented meaning, and none includes the search field that ships

### C3 — Wave 4: catalogue SSR + SEO · ~12 pts · **contracted**

This is [SPEC-03](docs/specs/SPEC-03-storefront-seo-render.md) and the single largest contracted gap. All four catalogue pages are involved. **Hard prerequisite: the smoke suite** — cut from Sprint 1, still owed.

- [!] **Smoke suite: shop → PDP → cart → checkout** · 3 pts · *prerequisite for everything in C3*
- [ ] **G-7: SSR-capable api-client** · 2 pts · `web/lib/api.js` is `'use client'`, so Server Components cannot use it. Build early — everything else in C3 depends on it, and nothing else does
- [ ] **Convert `/shop` to a Server Component** · 3 pts
- [ ] **Convert `/product/[slug]` to a Server Component** · 3 pts · also moves the `Product`/`Offer` JSON-LD out of post-hydration
- [ ] **`generateMetadata` for product + category** · 1 pt · currently exists in `category/[slug]` only; no per-product `<title>` or OG tags
- [ ] **`sitemap.xml` + `robots.txt`** · 1 pt · neither exists
- [ ] **BreadcrumbList schema on PDP** · 1 pt · the design already specifies a breadcrumb (1240×21)

### C4 — Commerce depth · ~10 pts

- [ ] **Design the lens / coating configurator** · 0 pts (design) · **contracted** ([SPEC-07](docs/specs/SPEC-07-lens-configurator.md)). No design and no price model
- [!] **Lens price list from client** · blocked · cannot build a configurator without it
- [ ] **Build the lens configurator** · 5 pts · PDP currently emits a fixed `Lens: Standard` string into the cart variant
- [ ] **PDP stock / availability indicator** · 2 pts · `inventory` is per-branch and nothing surfaces it
- [!] **Stock check at checkout** · 2 pts · blocked on the client's out-of-stock rule (H1)
- [ ] **Mobile + tablet breakpoints for all catalogue pages** · 3 pts · **every Figma frame is 1440 desktop only.** Shop, PDP, category and search are all live on breakpoints that were developer guesses

### C5 — Deferred, not scoped

Real gaps, but nothing downstream waits on them. Implementations for the first two exist on `archive/venky-optex`.

- [ ] Wishlist / favourites · needs design + `wishlists` table + endpoints
- [ ] Product comparison · needs design
- [ ] FAQ page · exists only as a footer link in the design

---

## Cross-cutting debt

- [ ] **ESLint config** · 1 pt · `pnpm -r lint` is broken; no config or dependency anywhere in the repo
- [ ] **`typecheck` script for `apps/web`** · 0.5 pt · 40 `.jsx` files, and it is the only workspace package without one
- [ ] **Resolve the two navies** · 1 pt · design uses `#2E3192`, `packages/config/tailwind.preset.js:28` defines `brand.blue` as `#2A3182`; 20 files use one, 15 the other
- [ ] **Resolve the two nav bar heights** · 0 pts (design) · 135px on most pages, 87px on About and Eye care. Both ship
- [ ] **Clean the Figma placeholder content** · 0 pts (design) · the `+91` phone, Oakley/Rayban sample brands, `(124 Customer Reviews)`, `Frame: Midnight Matte | Lens: Blue Light Filter`, and the USD-scale price ladder are all still in the file. Fixed in code, live in design — see [DESIGN-STATUS §4](docs/DESIGN-STATUS.md)
- [ ] **Archive Figma `v2` and `v3`** · 0 pts (design) · `v1` is canonical as of 2026-08-11

---

## Client-blocked

Nothing here moves without an answer. All were sent in [CLIENT-QUESTIONS.md](docs/CLIENT-QUESTIONS.md).

- [!] **Block A** — catalogue shape, appointment rules · blocks C1 import, SPEC-04 Phase 2
- [!] **B1–B3** — pickup stations, shipping rules · blocks SPEC-02 Phase 2
- [!] **H1** — out-of-stock behaviour · blocks the checkout stock check
- [!] **Lens price list** · blocks C4 entirely
- [!] **CR-01 quote** · Phase 1B gate is shut until signed
