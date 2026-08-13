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

- [x] **Smoke suite: shop → PDP → cart → checkout** · Playwright, 5 specs, `apps/web/e2e/smoke.spec.ts`. Runs against a **production build**, not `next dev` — per-route dev compilation made it flaky, and the suite exists to protect the Wave 4 render rewrite, so it should exercise the rendering customers get. 12s, stable across repeated runs. Third CI job.

**Sprint 1 is complete.** C3 / Wave 4 is now unblocked.

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

- [x] **Smoke suite: shop → PDP → cart → checkout** · done, the C3 gate is open
- [x] **G-7: SSR-capable api-client** · `apps/web/lib/api-server.js`. Two factories: `publicApi()` (no cookies, cacheable — what the catalogue wants) and `sessionApi()` (cookies, dynamic). The split is explicit because picking the wrong one silently costs the caching Wave 4 exists to gain
- [x] **Convert `/shop` to a Server Component** · now `○ (Static)` prerendered. Products, prices and links are in the raw HTML; a crawler previously saw an empty grid. Interactive half split into `components/shop/ShopBrowser.jsx`
- [x] **`metadataBase` on the root layout** · not in the original plan. Without it every `alternates.canonical` rendered relative (`/shop`), and a relative canonical is treated as no canonical at all
- [ ] **Server-side faceting for `/shop`** · 2 pts · the page still fetches `limit: 100` and facets in the browser, because the counts beside each facet span the whole set. The API already accepts category/brand/shape/gender/material/price/sort — move it once the real catalogue lands
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

## 2. Storefront — Cart & Checkout

- [x] **Guest-cart merge at sign-in** · merges silently — asking "keep your items?" is a question with one sensible answer. Guest cart now persists in localStorage (it was in-memory only, so any full page load discarded it and made the merge pointless), carries over line by line at sign-in, and clears before the requests so a half-failed merge cannot double an order. Covered by `e2e/cart-merge.spec.ts`
- [x] **Cart empty state** · Sprint 2 P1. Replaces the two-column layout — which offered a promo box with nothing to discount, a KSH 0.00 summary and a checkout button leading nowhere — with one panel and two ways forward. `CartContext` now exposes `loading`, so it does not flash for a customer whose cart is still arriving
- [ ] **M-Pesa "waiting for confirmation" state at checkout** · 2 pts · STK confirms asynchronously; the customer waits on their phone with no on-screen state
- [ ] **Invoice / receipt download** · 2 pts · no PDF, no endpoint
- [!] **Stock check at checkout** · 2 pts · blocked on client H1
- [!] **Pickup-station delivery** · blocked on client B1–B3 ([SPEC-02](docs/specs/SPEC-02-checkout-fulfilment.md))
- [!] **Shipping-rule engine** · blocked on B1–B3 · `shipping_kes` is set but never computed
- [ ] **Guest checkout** · deferred · `orders.customer_id` is NOT NULL since `0006`; a real decision, not an oversight

## 3. Storefront — Account & Orders

- [ ] **Verified-purchase check on reviews** · 2 pts · enforced on **neither** path. No `verified_purchase` column, no order lookup in `ReviewsService.createForProduct`. Needs a product decision: gate reviews, or drop the claim
- [~] **Customer-initiated order cancel** · **re-estimated 2 pts → ~7**. It is not a status flip: CLIENT-ANSWERS B5 and [SPEC-06](docs/specs/SPEC-06-order-lifecycle.md) specify a request/approval workflow with admin-set thresholds, notifications and a paid-order acknowledgement.
  - [x] **R2 eligibility, server-side** · `CancellationService` + `app_settings` (first slice of SPEC-05). 24h window and not-after-dispatch cut-off, both configurable, with documented defaults that never fall back to zero
  - [x] **R1 customer request** · `GET`/`POST /api/orders/:id/cancellation`. Reason optional, one pending request per order enforced by a partial unique index, response says *received* not *approved*
  - [x] **R6 guest appointment path closed** · shipped as Sprint 2 #2/#3
  - [x] **R3 admin approval workflow** · `/cancellations` admin screen with a live pending badge in the nav. Each row carries what the decision depends on — payment status, fulfilment stage, reason, time waiting — and flags an order that moved on while the request sat pending. Approve cancels the order; decline records a customer-facing reason and changes nothing. Every decision stores `decided_by` and `decided_at`
  - [ ] **R3 remainder: direct admin cancel without a request** · the phone-call path
  - [x] **R4 outcome notifications** · email + SMS on both outcomes, sent *after* the decision commits and wrapped so a failure cannot reverse it. The decline message carries the admin's reason — a decline without one is the phone call this feature replaces. Covered by a test that forces both channels to throw and asserts the approval still stands
  - [~] **R5 paid-order acknowledgement** · the API refuses to approve a paid order without `acknowledgePaid`, and the admin screen makes it a dialog rather than a second click. Still to do: the flag on the admin Payments screen
  - [ ] **R7 reversed payments surfaced** · `reversed` is recorded and then ignored
  - [x] **Customer UI on order history and tracking** · `components/orders/CancelOrder.jsx`, four states from one API call: requestable, pending, decided, ineligible-with-reason. Renders whatever the server says and decides nothing
  - [x] **Two page-breaking bugs found while wiring it** · `/profile` order history filtered `customer_id` by the **auth user id**, so it had never shown an order to anyone; the tracking page selected `orders.shipping_address`, a column that does not exist, so it returned "Order not found" for **every** order
- [ ] **Saved addresses** · 2 pts · `shipping_address` is per order, not per customer
- [ ] **Reorder** · 1 pt
- [ ] **Social login** · deferred · no provider configured; the dead Google/Apple buttons were removed from `/login`

## 4. Storefront — Appointments & Branches

- [x] **Account required to book** · Sprint 2 #2/#3. `/appointments` redirects on mount (it used to bounce the customer only on submit, after they had picked a branch, date, slot and filled in details), and migration `0011` makes `customer_id` NOT NULL so the schema agrees with the API
- [ ] **Design `/appointments`** · 0 pts (design) · **P0 of the design backlog** — contracted, fully built, never designed
- [ ] **Branch coordinates + locator map** · 2 pts · `branches.lat`/`lng` exist; **zero of 27 branches have them**. Geocoding is a data task before it is a UI one
- [!] **Configurable slot duration / capacity / breaks** · blocked on client A5–A6 ([SPEC-04](docs/specs/SPEC-04-appointment-scheduling.md) Phase 2) · `SLOT_MINUTES = 30` is hardcoded and capacity is hardwired to 1

## 5. Storefront — Content & Trust

Launch blockers from [NEXT-PLAN M2](docs/NEXT-PLAN.md) — these are not gaps, they are things currently published that are **wrong**.

- [ ] **Rewrite the returns policy** · 1 pt · 175 lines describing a returns process. Client confirmed **no refunds**
- [ ] **Rewrite the delivery policy** · 1 pt · 196 lines contradicting the confirmed model
- [ ] **Delete the invented testimonials** · 0.5 pt · "Sarah Johnson", "Michael Chen", "Emily Rodriguez" on a Kenyan storefront (`Testimonials.jsx:7`). Hide the section until real ones exist
- [ ] **Hide the VirtualTryOn section** · 0.5 pt · 41 lines advertising "smart camera technology". VTO is Phase 3 by contract — it must ship hidden
- [ ] **De-duplicate the contact backend** · 1 pt · `web/app/api/contact/route.ts` *and* Nest `POST /api/contact` — two Resend integrations for one form
- [ ] **FAQ page** · 2 pts · exists only as a footer link

## 6. Admin panel

- [ ] **Customers → Deactivate** · 1 pt · the last `coming soon` marker in the repo (`Customers.tsx:240`)
- [ ] **Promo banner create/delete UI** · 2 pts · the API has full CRUD; the UI only lists and toggles active
- [!] **Inventory ledger** · CR-01 · `inventory` is `(product_id, branch_id, stock)` — no movements, no reorder threshold
- [!] **RBAC / audit log / 2FA** · CR-01 · gate shut until the quote is signed

## 7. API migration — Waves 3 and 5

Wave 4 is C3 above. These are the other two.

- [ ] **Wave 3 — web account & cart reads** · 4 pts · profile, orders, tracking, cart promo. 13 direct Supabase reads remain across 7 files
- [ ] **Wave 5 — delete the read helpers** · 1 pt · once Waves 3–4 land, remove them from `packages/db` so the old path cannot come back. A deleted function cannot be called

---

## Cross-cutting debt

- [ ] **ESLint config** · 1 pt · `pnpm -r lint` is broken; no config or dependency anywhere in the repo
- [ ] **`typecheck` script for `apps/web`** · 0.5 pt · 40 `.jsx` files, and it is the only workspace package without one
- [ ] **Resolve the two navies** · 1 pt · design uses `#2E3192`, `packages/config/tailwind.preset.js:28` defines `brand.blue` as `#2A3182`; 20 files use one, 15 the other
- [ ] **Resolve the two nav bar heights** · 0 pts (design) · 135px on most pages, 87px on About and Eye care. Both ship
- [ ] **Clean the Figma placeholder content** · 0 pts (design) · the `+91` phone, Oakley/Rayban sample brands, `(124 Customer Reviews)`, `Frame: Midnight Matte | Lens: Blue Light Filter`, and the USD-scale price ladder are all still in the file. Fixed in code, live in design — see [DESIGN-STATUS §4](docs/DESIGN-STATUS.md)
- [ ] **Archive Figma `v2` and `v3`** · 0 pts (design) · `v1` is canonical as of 2026-08-11

---

## Design backlog — blocked on Figma access

I have **view-only** access to the Asan file, so none of these can be drawn. Each is specified in [DESIGN-STATUS.md](docs/DESIGN-STATUS.md) well enough for a designer to work from.

- [!] `/appointments` — P0. Contracted, built, undesigned
- [!] `/orders/[id]/tracking` and `/order-confirmation/[orderId]` — the entire post-purchase experience
- [!] `/search` and `/category/[slug]`
- [!] The 6 Shop facets, sort and pagination now shipping in code
- [!] The nav search field — 4 nav variants exist, none has one
- [!] `/forgot-password`, `/reset-password`, and the 4 policy pages
- [!] **Mobile and tablet breakpoints for every page** — every frame is 1440 desktop only, so every responsive layout in production was a developer guess
- [!] Lens configurator — contracted, no design and no price model

---

## Client-blocked

Nothing here moves without an answer. All were sent in [CLIENT-QUESTIONS.md](docs/CLIENT-QUESTIONS.md).

- [!] **Block A** — catalogue shape, appointment rules · blocks C1 import, SPEC-04 Phase 2
- [!] **B1–B3** — pickup stations, shipping rules · blocks SPEC-02 Phase 2
- [!] **H1** — out-of-stock behaviour · blocks the checkout stock check
- [!] **Lens price list** · blocks C4 entirely
- [!] **CR-01 quote** · Phase 1B gate is shut until signed
