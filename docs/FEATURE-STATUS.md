# OPTEX — Feature Status (derived from the codebase)

**Date:** 2026-08-11 · **Commit:** `main` @ `e8cfcec`

Every entry below was determined by reading the code, not from any tracker or checklist. Status means:

- **✅ Done** — works end to end against real data; no stub, no hardcoded fixture, no dead wiring
- **🟡 Partial** — works, but with a specific named gap
- **❌ Absent** — no implementing code exists

**Codebase cleanliness:** a scan for `TODO`, `FIXME`, `HACK`, `not implemented` and `coming soon` across `apps/*` and `packages/*` returns **one hit** — the disabled Customers "Deactivate" action. It is the last incompleteness marker in the repo.

**What changed since the 2026-08-03 revision:** `development` and `feature-changes` were merged into `main` and deleted. That brought in Waves 1–2 of the API migration, migration `0009`, the storefront redesign, the Eye Care and About pages, and fixes for a set of fabricated-data defects found in review. Numbers below were re-measured against the merged tree, not carried forward.

---

## 0. Where we are — API migration waves

The migration sequence is defined in [API-MIGRATION-PLAN.md §3](API-MIGRATION-PLAN.md). Position as of `e8cfcec`:

| Wave | Scope | Status |
| --- | --- | --- |
| **0** — Prerequisites | CI + smoke suite before any migration | ❌ **Never done.** Waves 1–2 shipped without it. See §12 |
| **1** — Kill all 17 writes | Every browser-side Supabase write → API | ✅ **Done** (`f74b009`, verified `34bf15f`) |
| **2** — Admin reads | All 12 admin pages read via API | ✅ **Done** (`2c1fb07`) |
| **3** — Web account & cart reads | Profile, orders, tracking, cart promo | ⬜ **Not started** |
| **4** — Web catalogue reads + render mode | Shop/PDP/category server-rendered — this is [SPEC-03](specs/SPEC-03-storefront-seo-render.md), the contracted SEO deliverable | ⬜ **Not started.** The big one |
| **5** — Lock the door | Delete read helpers so the old path cannot return | ⬜ **Not started** |

**Verified counts on the merged tree** (excluding `.next` build output and `Array.from` false positives):

- Direct Supabase **writes** in `apps/web` + `apps/admin`: **0** — Wave 1 holds after the merge
- Direct Supabase **reads** in `apps/admin`: **0** — Wave 2 holds
- Direct Supabase **reads** in `apps/web`: **13**, across 7 files — this is exactly the Wave 3 + Wave 4 backlog:

  `category/[slug]` ×2 · `product/[slug]` ×4 · `order-confirmation/[orderId]` ×2 · `profile` ×2 · `branch-locator` ×1 · `cart` ×1 · `orders/[id]/tracking` ×1

The merge was the risk point here — `feature-changes` was built on the pre-Wave-1 tree, so taking its version of the storefront could have silently reintroduced direct writes. It did not: the one file that mattered, the PDP review form, was hand-merged back onto `api.reviews.create`.

---

## 1. Storefront — Catalogue & Discovery

| Feature | Status | Evidence |
| --- | --- | --- |
| Home page | ✅ | `app/page.jsx` + 11 home components |
| Product listing (shop) | ✅ | `app/shop/page.jsx` |
| Product detail page | ✅ | `app/product/[slug]/page.jsx` |
| Category landing pages | ✅ | `app/category/[slug]/page.jsx` — the **only Server Component in the app** |
| Full-text search | ✅ | `search_tsv` GIN index; `GET /api/products/search` |
| Related products | ✅ | `GET /api/products/:id/related` |
| Filter — category / brand | ✅ | `shop/page.jsx` |
| Filter — price range | ✅ | 5 bands, `f03d809` |
| Filter — frame shape | ✅ | `f03d809` |
| Filter — gender | ✅ | `f03d809`. Self-hides below 2 distinct values — every seeded product is `unisex`, so it correctly does not render today |
| Filter — frame material | ✅ | `f03d809`. Values grouped case-insensitively; the seed carries both `Metal` and `metal` |
| Sort | ✅ | Featured / price ↑↓ / name, `f03d809` |
| **Pagination** | ❌ | `listProducts` caps at `limit: 100` with no paging UI |
| **Empty state** | ❌ | No "no products match" treatment — now reachable, since filters can exclude everything |
| **Search autocomplete** | ❌ | No debounce, suggest or typeahead code |
| **Wishlist / favourites** | ❌ | No table, no endpoint, no UI |
| **Product comparison** | ❌ | |
| **Lens / coating configurator** | ❌ | No price model. PDP emits a fixed `Lens: Standard` string into the cart variant |

> The four filters and sort shipped in `f03d809` but are **not yet in Figma** — the Shop screen still specifies only Categories and Brands. See [DESIGN-STATUS §5](DESIGN-STATUS.md). Full plan for this section: [TASKS.md §1](../TASKS.md).

> An implementation of search autocomplete, product filters and a wishlist exists on the archived `archive/venky-optex` tag. It is an orphan tree that predates Waves 1–2 and its migrations collide with `0009`, so it is a cherry-pick source, not a merge.

## 2. Storefront — Cart & Checkout

| Feature | Status | Evidence |
| --- | --- | --- |
| Server-persisted cart | ✅ | `carts` + `cart_items`; survives sessions |
| Add / update / remove line items | ✅ | `cart.service.ts`; atomic upsert guards the create race |
| Cart error surfacing | ✅ | Provider renders API rejections (stock, quantity bounds) as a dismissible alert |
| Promo code entry | ✅ | `POST /api/promo/validate`, `POST /api/cart/apply-promo` |
| Multi-step checkout | ✅ | `app/checkout/page.jsx` — fully on the API |
| Atomic order placement | ✅ | `place_order` Postgres RPC (`0008`) |
| VAT calculation | ✅ | `orders.vat_kes` |
| Money formatting | ✅ | `formatKes` / `formatKesNumber`, both NaN/null-safe, both grouped |
| Order confirmation page | ✅ | `app/order-confirmation/[orderId]` |
| **Guest cart → account merge** | ❌ | Sign-in **replaces** local state with the server cart, so a guest who fills a cart then logs in to check out loses it. Documented in `CartContext`; unbuilt |
| **Guest checkout** | 🟡 | `orders.customer_id` NOT NULL since `0006`; cart endpoints require auth |
| **Pickup-station delivery** | ❌ | Checkout collects a street address. No station model |
| **Shipping-rule engine** | ❌ | No threshold, no geo-scoping; `shipping_kes` is set but never computed |
| **Invoice / receipt download** | ❌ | No PDF, no endpoint |

## 3. Storefront — Account & Orders

| Feature | Status | Evidence |
| --- | --- | --- |
| Signup / login / logout | ✅ | Supabase Auth + `/api/auth/*` |
| Forgot / reset password | ✅ | Supabase-native; no API equivalent |
| Profile view + edit | ✅ | `GET`/`PATCH /api/me` |
| Order history | ✅ | `GET /api/orders` |
| Multi-stage order tracking | ✅ | 6-stage `order_status` enum; `GET /api/orders/:id/tracking` |
| Prescription upload | ✅ | `POST /api/prescriptions/upload`, private bucket, per-customer namespacing |
| Prescription download | ✅ | Ownership-checked 60s signed URL |
| Write a product review | ✅ | `POST /api/products/:productId/reviews`, moderation + one-per-product guard |
| **Verified-purchase check on reviews** | ❌ | Enforced on **neither** path. No `verified_purchase` column, no order lookup in `ReviewsService.createForProduct`. Migration `0009`'s comment used to claim otherwise; corrected |
| **Social login (Google / Apple)** | ❌ | No provider configured. The non-functional buttons were removed from `/login` |
| **Customer-initiated order cancel** | ❌ | No endpoint; `cancelled` is admin-only |
| **Reorder** | ❌ | |
| **Saved addresses** | ❌ | `shipping_address` is per order, not per customer |

## 4. Storefront — Appointments & Branches

| Feature | Status | Evidence |
| --- | --- | --- |
| Slot availability lookup | ✅ | `GET /api/appointments/slots` |
| Booking (incl. guest) | ✅ | `contact_name`/`contact_phone` support guests |
| Cancel / reschedule | ✅ | `PATCH /api/appointments/:id/{cancel,reschedule}` |
| Slot validation | ✅ | `assertSlotBookable()` — branch hours, grid alignment, double-book guard |
| Confirmation SMS | ✅ | `sms.service.ts`, best-effort, never rolls back a booking |
| Reminder SMS (24h + 1h) | ✅ | `cron/appointment-reminders.job.ts`, every 15 min |
| Branch locator (list) | ✅ | `GET /api/branches` |
| **Configurable slot duration** | ❌ | `SLOT_MINUTES = 30` hardcoded |
| **Multiple bookings per slot** | ❌ | Capacity hardwired to 1 |
| **Lunch / buffer breaks** | ❌ | `generateSlots(open, close)` is a straight range — missing code, not config |
| **Branch locator map** | ❌ | `branches.lat`/`lng` exist; zero of 27 real branches have coordinates |
| **Doctor / optometrist model** | ❌ | CR-01 |

## 5. Storefront — Content & Trust

| Feature | Status | Evidence |
| --- | --- | --- |
| Privacy / Delivery / Returns / Warranty policies | ✅ | 4 pages, ~780 lines; privacy references DPA 2019 |
| Eye Care page | ✅ | `app/eye-care/page.jsx` — patient record + booking intake |
| About page | ✅ | `app/about/page.jsx` |
| Contact page + form | 🟡 | **Duplicated backend** — `web/app/api/contact/route.ts` *and* Nest `POST /api/contact`, two Resend integrations |
| **WhatsApp chat** | ❌ | Zero references in the repo |
| **FAQ page** | ❌ | |

## 6. Storefront — Home page sections

| Section | Status | Note |
| --- | --- | --- |
| Hero, WhyOptex, FinalCTA, Promotional | ✅ | Static marketing — correct as-is |
| FeaturedProducts, TrendingNow, FeaturedCollection | ✅ | DB-driven. Brand falls back to `—`, not an invented brand |
| FaceShape | ✅ | Static style guide; no backend claimed |
| **Testimonials** | 🟡 | **Still hardcoded fake reviews** (`Testimonials.jsx:7`) — "Sarah Johnson", "Michael Chen", "Emily Rodriguez" on a Kenyan storefront. Fix before any client demo |
| **VirtualTryOn** | 🟡 | Marketing copy promising "smart camera technology" (`VirtualTryOn.jsx:41`). **Advertises a feature that does not exist** — VTO is Phase 3 |

## 7. Admin panel — 12 pages, all API-routed

| Page | Status | Note |
| --- | --- | --- |
| Dashboard | ✅ | Real KPIs, revenue chart, payment-method pie |
| Products | ✅ | Full CRUD + image upload |
| Orders | ✅ | List, detail, status update |
| Appointments | ✅ | Confirm / cancel / reschedule; embeds normalised |
| Reviews | ✅ | Moderation queue |
| Branches | ✅ | List + update, real per-weekday hours shape |
| Analytics | ✅ | Real revenue by category + period-over-period growth |
| Payments | ✅ | Real reconcile + link |
| Prescriptions | ✅ | Signed-URL viewer, mark processed |
| **Customers** | 🟡 | **Deactivate action disabled** (`Customers.tsx:240`, `title="Coming soon"`) — the last incompleteness marker in the repo |
| **Inventory** | 🟡 | Stock-level editor only. `inventory` is `(product_id, branch_id, stock)` — no ledger, no movements, no reorder threshold |
| **Promotions** | 🟡 | Codes: full CRUD. Banners: list + activate toggle only — **the create and delete endpoints exist but have no UI** |
| **RBAC / multi-role** | ❌ | Single `super_admin`. CR-01 |
| **Audit log** | ❌ | CR-01 |
| **2FA** | ❌ | CR-01 |

## 8. API — 16 modules

| Module | Status |
| --- | --- |
| auth, account, catalog, cart, orders/checkout, payments, notifications, appointments, prescriptions, reviews, promotions, branches, admin-metrics, customers, inventory, cron | ✅ |
| Swagger at `/api/docs` | ✅ |

`customers` and `inventory` were added in Wave 2 to unblock the admin read migration. `pnpm -r typecheck` passes clean across the monorepo; the API boots with 0 errors and every route mapped.

## 9. Integrations

| Integration | Status | Evidence |
| --- | --- | --- |
| M-Pesa Daraja — STK push | ✅ | `mpesa.service.ts`, full OAuth |
| M-Pesa — callback webhook | ✅ | `POST /api/webhooks/mpesa` |
| M-Pesa — status polling | ✅ | `cron/mpesa-polling.job.ts`, every 2 min |
| Pesapal — redirect + IPN | ✅ | `pesapal.service.ts`, POST and GET IPN |
| Africa's Talking SMS | ✅ | `sms.service.ts` |
| Resend email | ✅ | `email.service.ts` |
| Supabase Auth / Storage / Postgres | ✅ | |
| **Google Maps** | ❌ | No API key, no map component |
| **eTIMS / KRA e-invoicing** | ❌ | Nothing in schema or code |
| **GA4 / analytics** | ❌ | No gtag, GTM, or any analytics library |
| **WhatsApp Business** | ❌ | |

> Payments, SMS and email are **read from the code, not observed**. They need real Daraja / Pesapal / Africa's Talking credentials to exercise, so their ✅ means "wired end to end", not "seen working".

## 10. Database — 16 tables, 9 migrations

`branches · categories · products · inventory · customers · orders · order_items · carts · cart_items · appointments · prescriptions · product_reviews · promo_codes · promo_banners · mpesa_transactions · pesapal_transactions`

All ✅ with RLS. `0001`–`0009`. `products.try_on_image_url` already exists for Phase 3.

`0009_rls_write_lockdown` closed the direct-write bypass: customer-writable policies dropped on `appointments` and `product_reviews`, `carts`/`cart_items` downgraded to SELECT-only. The `is_super_admin()`-gated admin policies remain as break-glass.

**Absent (all CR-01):** `roles`, `permissions`, `audit_log`, `suppliers`, `purchase_orders`, `grn`, `stock_ledger`, `stock_transfers`, `doctors`, `doctor_availability`, `consultations`, `branch_capex`, `branch_opex`. Also **`products.cost_price`** — margin analysis has nowhere to read from.

## 11. SEO

| Feature | Status | Evidence |
| --- | --- | --- |
| `LocalBusiness` + `MedicalOrganization` JSON-LD | ✅ | `layout.jsx:21` |
| `PostalAddress`, `GeoCoordinates`, `OpeningHoursSpecification` | ✅ | |
| **`generateMetadata`** | 🟡 | Exists in **one** file — `category/[slug]/page.jsx:9`. No per-product `<title>` or OG tags |
| **`Product` / `Brand` / `Offer` JSON-LD** | 🟡 | On the PDP, but the file is `'use client'`, so it renders **after hydration** |
| **Server-side rendering** | ❌ | **15 of 23 pages are `'use client'`.** Only `category/[slug]` is a Server Component |
| **`sitemap.xml`** | ❌ | Does not exist |
| **`robots.txt`** | ❌ | Does not exist |
| **FAQ schema** | ❌ | |
| **BreadcrumbList schema** | ❌ | |
| **Core Web Vitals tuning** | ❌ | Client-rendering is the root cause |

This whole section is Wave 4 / [SPEC-03](specs/SPEC-03-storefront-seo-render.md). It is the single largest contracted gap.

## 12. Engineering infrastructure

| Item | Status | Evidence |
| --- | --- | --- |
| pnpm monorepo, 3 apps + 5 packages | ✅ | |
| Docker Supabase dev stack | ✅ | Postgres, Auth, REST, Storage, Kong |
| Typed API client | ✅ | `@optex/api-client` |
| Prettier | ✅ | `.prettierrc`, applied tree-wide |
| API migration — writes | ✅ | 0 direct writes remain in web or admin |
| API migration — admin reads | ✅ | 0 direct reads remain in admin |
| **API migration — web reads** | 🟡 | **13 sites across 7 files.** Waves 3–4 |
| **CI / CD** | ❌ | No `.github/` directory. This was Wave 0's hard prerequisite and it was skipped |
| **Tests** | ❌ | One API smoke spec (`apps/api/test/app.e2e-spec.ts`). **Zero in web and admin** |
| **ESLint** | ❌ | `pnpm -r lint` is broken — no config or dependency anywhere |
| **TypeScript in `apps/web`** | ❌ | **40 `.jsx` files**, no `typecheck` script |

---

## Summary

| Area | ✅ Done | 🟡 Partial | ❌ Absent |
| --- | --- | --- | --- |
| Catalogue & discovery | 12 | 0 | 6 |
| Cart & checkout | 9 | 1 | 4 |
| Account & orders | 8 | 0 | 5 |
| Appointments & branches | 7 | 0 | 5 |
| Content & trust | 3 | 1 | 2 |
| Home sections | 3 | 2 | 0 |
| Admin | 9 | 3 | 3 |
| API | 2 | 0 | 0 |
| Integrations | 7 | 0 | 4 |
| SEO | 2 | 2 | 6 |
| Engineering | 6 | 1 | 4 |
| **Total** | **68** | **10** | **39** |

Of the 41 absent items, **~20 are CR-01 or Phase 2/3** (RBAC, audit log, 2FA, inventory ledger, doctor module, branch P&L, product analytics, Flutter, VTO) — correctly out of scope.

**That leaves ~19 genuinely missing Phase 1A features.** Largest clusters, in the order they should be attacked (sequenced plan: [TASKS.md](../TASKS.md)):

1. **SEO / render mode — 8 items.** No sitemap, no robots, `generateMetadata` in one file only, 15 of 23 pages client-rendered. This is Wave 4, it is a contracted deliverable, and it is the biggest single gap.
2. **Engineering hygiene — 5 items.** No CI, no tests, no lint, `apps/web` untyped. Wave 0 was skipped to ship Waves 1–2; that debt is now the main thing standing between the codebase and safe further change.
3. ~~**Catalogue filters — 4 items.**~~ **Closed in `f03d809`** — price, shape, gender and material all ship, plus sort. They still need drawing into Figma. What remains on the Shop surface is pagination and an empty state.
4. **Commerce model — 4 items.** Guest-cart merge, pickup-station delivery, shipping rules, lens configurator.
5. **Integrations — 4 items.** Google Maps, eTIMS, GA4, WhatsApp.

**Fix before any client demo:** the hardcoded Western testimonials on a Kenyan storefront, and the homepage section advertising a Virtual Try-On that does not exist. Both are content-level and cheap.

**Two trust gaps worth an explicit decision:** reviews have no verified-purchase check on either path, and the guest cart is silently discarded at sign-in on the one journey — checkout — where it matters most.
