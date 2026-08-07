# OPTEX — Feature Status (derived from the codebase)

**Date:** 2026-08-03 · **Commit:** `development` @ `0d2233f`

Every entry below was determined by reading the code, not from any tracker or checklist. Status means:

- **✅ Done** — works end to end against real data; no stub, no hardcoded fixture, no dead wiring
- **🟡 Partial** — works, but with a specific named gap
- **❌ Absent** — no implementing code exists

**Codebase cleanliness:** a full scan for `TODO`, `FIXME`, `HACK`, `placeholder`, `mock`, `dummy`, `stub`, `not implemented`, and `coming soon` across `apps/*` and `packages/*` returns **zero hits**. Only two incompleteness markers exist in the entire repo, both named below.

---

## 1. Storefront — Catalogue & Discovery

| Feature | Status | Evidence |
| --- | --- | --- |
| Home page | ✅ | `app/page.jsx` + 11 home components |
| Product listing (shop) | ✅ | `app/shop/page.jsx` |
| Product detail page | ✅ | `app/product/[slug]/page.jsx` (744 lines) |
| Category landing pages | ✅ | `app/category/[slug]/page.jsx` — the **only Server Component in the app** |
| Full-text search | ✅ | `search_tsv` GIN index; `GET /api/products/search` |
| Related products | ✅ | `GET /api/products/:id/related` |
| Filter — category | ✅ | `shop/page.jsx:12` |
| Filter — brand | ✅ | `shop/page.jsx:13` |
| Sort | ✅ | `shop/page.jsx:14` |
| **Filter — price range** | ❌ | No state variable exists |
| **Filter — frame shape** | ❌ | `products.frame_shape` column exists and is unused by the UI |
| **Filter — gender** | ❌ | `products.gender` column exists and is unused |
| **Filter — frame material** | ❌ | `products.frame_material` column exists and is unused |
| **Search autocomplete** | ❌ | No debounce, suggest, or typeahead code anywhere |
| **Wishlist / favourites** | ❌ | No table, no endpoint, no UI |
| **Product comparison** | ❌ | |
| **Lens / coating configurator** | ❌ | No price model. Only a hardcoded display string at `product/[slug]/page.jsx:589` |

## 2. Storefront — Cart & Checkout

| Feature | Status | Evidence |
| --- | --- | --- |
| Server-persisted cart | ✅ | `carts` + `cart_items`; survives sessions |
| Add / update / remove line items | ✅ | `cart.service.ts`; atomic upsert guards the create race |
| Promo code entry | ✅ | `POST /api/promo/validate`, `POST /api/cart/apply-promo` |
| Multi-step checkout | ✅ | `app/checkout/page.jsx` (663 lines) — **fully on the API** |
| Atomic order placement | ✅ | `place_order` Postgres RPC (`0008`) |
| VAT calculation | ✅ | `orders.vat_kes` |
| Order confirmation page | ✅ | `app/order-confirmation/[orderId]` |
| **Guest checkout** | 🟡 | `orders.customer_id` is NOT NULL since `0006`; cart endpoints require auth |
| **Pickup-station delivery** | ❌ | Checkout collects a street address; `KENYA_COUNTIES` at `checkout/page.jsx:108`. No station model |
| **Shipping-rule engine** | ❌ | No free-delivery threshold, no geo-scoping, `shipping_kes` is set but never computed |
| **Invoice / receipt download** | ❌ | No PDF, no endpoint |

## 3. Storefront — Account & Orders

| Feature | Status | Evidence |
| --- | --- | --- |
| Signup / login / logout | ✅ | Supabase Auth + `/api/auth/*` |
| Forgot / reset password | ✅ | Supabase-native; **no API equivalent exists** |
| Profile view + edit | ✅ | `GET`/`PATCH /api/me` |
| Order history | ✅ | `GET /api/orders` |
| Multi-stage order tracking | ✅ | 6-stage `order_status` enum; `GET /api/orders/:id/tracking` |
| Prescription upload | ✅ | `POST /api/prescriptions/upload`, private bucket, per-customer namespacing |
| Prescription download | ✅ | Ownership-checked 60s signed URL |
| Write a product review | ✅ | `POST /api/products/:productId/reviews` |
| **Customer-initiated order cancel** | ❌ | No endpoint; `cancelled` status is admin-only |
| **Reorder** | ❌ | |
| **Saved addresses** | ❌ | `shipping_address` is stored per order, not per customer |

## 4. Storefront — Appointments & Branches

| Feature | Status | Evidence |
| --- | --- | --- |
| Slot availability lookup | ✅ | `GET /api/appointments/slots` |
| Booking (incl. guest) | ✅ | `contact_name`/`contact_phone` columns support guests |
| Cancel / reschedule | ✅ | `PATCH /api/appointments/:id/{cancel,reschedule}` |
| Slot validation | ✅ | `assertSlotBookable()` — branch hours, grid alignment, double-book guard |
| Confirmation SMS | ✅ | `sms.service.ts`, best-effort, never rolls back a booking |
| Reminder SMS (24h + 1h) | ✅ | `cron/appointment-reminders.job.ts` |
| Branch locator (list) | ✅ | `GET /api/branches` |
| **Configurable slot duration** | ❌ | `SLOT_MINUTES = 30` **hardcoded** at `appointments.service.ts:33` |
| **Multiple bookings per slot** | ❌ | `takenTimes()` blocks any taken time — capacity is hardwired to 1 |
| **Lunch / buffer breaks** | ❌ | `generateSlots(open, close)` is a straight range. **Missing code, not config** |
| **Branch locator map** | ❌ | `branches.lat`/`lng` exist; **zero of 27 real branches have coordinates** |
| **Doctor / optometrist model** | ❌ | CR-01 |

## 5. Storefront — Content & Trust

| Feature | Status | Evidence |
| --- | --- | --- |
| Privacy policy | ✅ | 251 lines, references DPA 2019 |
| Delivery policy | ✅ | 196 lines |
| Returns policy | ✅ | 175 lines |
| Warranty policy | ✅ | 157 lines |
| Contact page + form | 🟡 | 302 lines. **Duplicated backend** — `web/app/api/contact/route.ts` *and* Nest `POST /api/contact`, two Resend integrations |
| **WhatsApp chat** | ❌ | Zero references in the repo |
| **FAQ page** | ❌ | |

## 6. Storefront — Home page sections

| Section | Status | Note |
| --- | --- | --- |
| Hero, WhyOptex, FinalCTA, Promotional | ✅ | Static marketing — correct as-is |
| FeaturedProducts, TrendingNow, FeaturedCollection | ✅ | DB-driven |
| **Testimonials** | 🟡 | **Hardcoded fake reviews** (`Testimonials.jsx:4`) — "Sarah Johnson", "Michael Chen", "Emily Rodriguez" on a Kenyan storefront. Should not ship as-is |
| **VirtualTryOn** | 🟡 | 41 lines of marketing copy promising "smart camera technology". **Advertises a feature that does not exist** — VTO is Phase 3 |
| FaceShape | ✅ | 108-line static style guide; no backend claimed |

## 7. Admin panel — 12 pages, all DB-backed

| Page | Status | Note |
| --- | --- | --- |
| Dashboard | ✅ | Real KPIs, revenue chart, payment-method pie |
| Products | ✅ | Full CRUD + image upload |
| Orders | ✅ | List, detail, status update — API-routed |
| Customers | 🟡 | **Deactivate button disabled** (`Customers.tsx:238`) — 1 of only 2 incompleteness markers in the repo |
| Appointments | ✅ | Confirm / cancel / reschedule |
| Inventory | 🟡 | Stock-level editor only. `inventory` table is `(product_id, branch_id, stock)` — **no ledger, no movements, no reorder threshold** |
| Reviews | ✅ | Moderation queue — API-routed |
| Promotions | 🟡 | Codes: full CRUD. **Banners: create/delete endpoints exist but there is no UI for them** |
| Branches | ✅ | List + update |
| Analytics | 🟡 | **Hardcoded `categoryPerformance`** (`Analytics.tsx:30`) — the other incompleteness marker |
| Payments | ✅ | Real reconcile + link |
| Prescriptions | ✅ | Signed-URL viewer, mark processed |
| **RBAC / multi-role** | ❌ | Single `super_admin`. CR-01 |
| **Audit log** | ❌ | CR-01 |
| **2FA** | ❌ | CR-01 |

## 8. API — 24 controllers, 68 routes, 13 modules

| Module | Status |
| --- | --- |
| auth, catalog, cart, orders/checkout, payments, notifications, appointments, prescriptions, reviews, promotions, branches, admin-metrics, cron | ✅ |
| Swagger at `/api/docs` | ✅ |
| **8 known endpoint gaps (G-1…G-8)** | 🟡 | See [ROADMAP D.0](ROADMAP.md) |

Notable: `pnpm -r typecheck` passes clean across the whole monorepo.

## 9. Integrations

| Integration | Status | Evidence |
| --- | --- | --- |
| M-Pesa Daraja — STK push | ✅ | `mpesa.service.ts`, full OAuth |
| M-Pesa — callback webhook | ✅ | `POST /api/webhooks/mpesa` |
| M-Pesa — status polling | ✅ | `cron/mpesa-polling.job.ts` |
| Pesapal — redirect + IPN | ✅ | `pesapal.service.ts`, POST and GET IPN |
| Africa's Talking SMS | ✅ | `sms.service.ts` |
| Resend email | ✅ | `email.service.ts` |
| Supabase Auth / Storage / Postgres | ✅ | |
| **Google Maps** | ❌ | No API key, no map component |
| **eTIMS / KRA e-invoicing** | ❌ | Nothing in schema or code |
| **GA4 / analytics** | ❌ | No gtag, GTM, or any analytics library |
| **WhatsApp Business** | ❌ | |

## 10. Database — 16 tables

`branches · categories · products · inventory · customers · orders · order_items · carts · cart_items · appointments · prescriptions · product_reviews · promo_codes · promo_banners · mpesa_transactions · pesapal_transactions`

All ✅ with RLS. 8 migrations (`0001`–`0008`). `products.try_on_image_url` already exists for Phase 3.

**Absent (all CR-01):** `roles`, `permissions`, `audit_log`, `suppliers`, `purchase_orders`, `grn`, `stock_ledger`, `stock_transfers`, `doctors`, `doctor_availability`, `consultations`, `branch_capex`, `branch_opex`. Also **`products.cost_price`** — margin analysis has nowhere to read from.

## 11. SEO

| Feature | Status | Evidence |
| --- | --- | --- |
| `LocalBusiness` + `MedicalOrganization` JSON-LD | ✅ | `layout.jsx:21` |
| `Product` / `Brand` / `Offer` JSON-LD | 🟡 | `product/[slug]/page.jsx:361` — but the file is `'use client'`, so it renders **after hydration** |
| `PostalAddress`, `GeoCoordinates`, `OpeningHoursSpecification` | ✅ | |
| **`generateMetadata`** | ❌ | **Zero occurrences in the entire app.** No per-product `<title>` or OG tags |
| **Server-side rendering** | ❌ | **16 of 22 pages are `'use client'`**. Only `category/[slug]` is a Server Component |
| **`sitemap.xml`** | ❌ | Does not exist |
| **`robots.txt`** | ❌ | Does not exist |
| **FAQ schema** | ❌ | |
| **BreadcrumbList schema** | ❌ | |
| **Core Web Vitals tuning** | ❌ | Client-rendering is the root cause |

## 12. Engineering infrastructure

| Item | Status | Evidence |
| --- | --- | --- |
| pnpm monorepo, 3 apps + 5 packages | ✅ | |
| Docker Supabase dev stack | ✅ | Postgres, Auth, REST, Storage, Kong |
| Typed API client | ✅ | `@optex/api-client`, 1,922 lines |
| Prettier | ✅ | |
| **CI / CD** | ❌ | No `.github/` directory at all |
| **Tests** | ❌ | One 78-line API smoke spec. **Zero in web and admin** |
| **ESLint** | ❌ | `pnpm -r lint` is broken — no config or dependency anywhere |
| **TypeScript in `apps/web`** | ❌ | **38 `.jsx` files**, no `typecheck` script |
| **API migration** | 🟡 | **13 browser-side Supabase writes still bypass the API** — one is a live double-booking bug at `Appointments.tsx:211` |

---

## Summary

| Area | ✅ Done | 🟡 Partial | ❌ Absent |
| --- | --- | --- | --- |
| Catalogue & discovery | 6 | 0 | 11 |
| Cart & checkout | 7 | 1 | 3 |
| Account & orders | 9 | 0 | 3 |
| Appointments & branches | 7 | 0 | 5 |
| Content & trust | 4 | 1 | 2 |
| Home sections | 3 | 2 | 0 |
| Admin | 8 | 4 | 3 |
| API | 13 | 1 | 0 |
| Integrations | 8 | 0 | 4 |
| SEO | 2 | 1 | 7 |
| Engineering | 4 | 1 | 4 |
| **Total** | **71** | **11** | **42** |

Of the 42 absent items, **21 are CR-01 or Phase 2/3** (RBAC, inventory ledger, doctor module, branch P&L, product analytics, Flutter, VTO) — correctly out of scope for now.

**That leaves 21 genuinely missing Phase 1A features.** The largest clusters:

1. **SEO — 7 items.** No `generateMetadata` anywhere, no sitemap, no robots, 16 of 22 pages client-rendered. This is a contracted deliverable and it is the single biggest gap.
2. **Engineering hygiene — 4 items.** No CI, no tests, no lint, `apps/web` untyped. Plus 13 browser-side writes still bypassing the API, one of them a live bug.
3. **Catalogue filters — 4 items.** Price, shape, gender, material. All three attribute columns already exist in `products` and are simply unused by the UI, so this is UI work only.
4. **Commerce model — 3 items.** Pickup-station delivery, shipping rules, lens configurator.
5. **Integrations — 4 items.** Google Maps, eTIMS, GA4, WhatsApp.

**Two content items should be fixed before any client demo:** the hardcoded Western testimonials on a Kenyan storefront, and the homepage section advertising a Virtual Try-On that does not exist.
