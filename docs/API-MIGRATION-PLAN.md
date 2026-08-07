# OPTEX — API Migration Plan

**Everything from the backend. No direct Supabase from web or admin.**

**Date:** 2026-08-07 · **Branch:** `development` @ `0d2233f`
**Supersedes:** [ROADMAP Part D](ROADMAP.md) — same goal, corrected inventory and revised sequence
**Basis:** exhaustive enumeration of every Supabase call site in `apps/web` and `apps/admin`

---

## 1. Executive summary

**The real number is 17 write sites, not 13.** Every prior document counts 13 because they were found by grepping `.from(`. Four more writes hide behind `@optex/db` query-helper functions, which look like a clean abstraction but execute Supabase queries **from the browser** with the customer's own token, authorised only by RLS.

**One of those four is critical and previously unreported:**

> `apps/web/app/appointments/page.jsx:359` calls `createAppointment()` from `@optex/db`, which does a raw `appointments` INSERT with **no validation whatsoever** — no branch-hours check, no slot-grid alignment, no double-booking guard. **The primary customer booking path never reaches the API at all.**

[CODE-REVIEW H-2](CODE-REVIEW.md) identified a time-of-check race in the API's booking path and a bypass in the admin panel. This is worse than both: the customer path has no check to race against. A customer can book a slot that is already taken, outside opening hours, on a day the branch is closed, at 3am, by calling the page's own code path.

**Three cart writes** (`addCartItem`, `updateCartItemQuantity`, `removeCartItem`) are in the same category — browser writes to `cart_items` bypassing `CartService` entirely.

### Why this keeps happening

There are **two parallel data-access layers**, and nothing says which is correct:

| Layer | What it is | Where it runs | Sites |
| --- | --- | --- | --- |
| `@optex/api-client` | Typed client for the NestJS API | Server or browser, via HTTP | Used by **2 files** |
| `@optex/db` + raw `.from()` | Supabase queries and query helpers | **Browser**, RLS-only | Used by **34 files** |

The API was built — 78 routes, 24 controllers, a 1,922-line typed client covering customer *and* admin. It is almost entirely unused by the apps it was built for. This is a **consumption problem, not a design problem**, which is why it is fixable in a defined number of steps rather than a rewrite.

The query-helper layer is the more dangerous of the two, because it *looks* like the right abstraction. A developer calling `createAppointment(db, {...})` reasonably assumes something is validating the appointment. Nothing is.

---

## 2. Complete call-site register

Authoritative. Every site, what replaces it, and whether the replacement exists today.

### 2.1 Writes — 17 sites

Writes first, because writes are where the bugs are. Reads are refactors.

| # | Site | Operation | API replacement | Exists? |
| --- | --- | --- | --- | --- |
| **W1** | `web/app/appointments/page.jsx:359` | `createAppointment()` → `appointments` INSERT | `api.appointments.create()` | ✅ |
| **W2** | `web/context/CartContext.js` | `addCartItem()` → `cart_items` INSERT/RPC | `api.cart.addItem()` | ✅ |
| **W3** | `web/context/CartContext.js` | `updateCartItemQuantity()` | `api.cart.updateItem()` | ✅ |
| **W4** | `web/context/CartContext.js` | `removeCartItem()` | `api.cart.removeItem()` | ✅ |
| **W5** | `web/app/product/[slug]/page.jsx:136` | `product_reviews` INSERT | `api.reviews.create()` | ✅ |
| **W6** | `admin/…/Appointments.tsx:164` | confirm | `api.admin.appointments.update()` | ✅ |
| **W7** | `admin/…/Appointments.tsx:185` | cancel | `api.admin.appointments.update()` | ✅ |
| **W8** | `admin/…/Appointments.tsx:210` | **reschedule** | `api.admin.appointments.update()` | ✅ |
| **W9** | `admin/…/Products.tsx:254` | product INSERT (`as any`) | `api.admin.products.create()` | ✅ |
| **W10** | `admin/…/Products.tsx:271` | product UPDATE | `api.admin.products.update()` | ✅ |
| **W11** | `admin/…/Products.tsx:288` | deactivate | `api.admin.products.remove()` | ✅ |
| **W12** | `admin/…/Promotions.tsx:120` | promo toggle | `api.admin.promos.update()` | ✅ |
| **W13** | `admin/…/Promotions.tsx:132` | promo DELETE | `api.admin.promos.remove()` | ✅ |
| **W14** | `admin/…/Promotions.tsx:145` | banner toggle | `api.admin.banners.*` | ✅ |
| **W15** | `admin/…/Promotions.tsx:157` | promo INSERT | `api.admin.promos.create()` | ✅ |
| **W16** | `admin/…/Prescriptions.tsx:188` | mark processed | `PATCH /admin/prescriptions/:id` | ❌ **G-1** |
| **W17** | `admin/…/Branches.tsx:215` | branch UPDATE | `api.admin.branches.update()` | ✅ |

**16 of 17 replacements already exist.** Only G-1 needs building. This is the single cheapest high-value change on the project.

### 2.2 Reads — 34 sites

| Area | Sites | API replacement | Exists? |
| --- | --- | --- | --- |
| **Web — catalogue** (`shop`, `search`, `product/[slug]`, `category/[slug]`, 3 home components) via `listProducts` / `listCategories` / `getProductBySlug` | 10 | `api.products.*`, `api.categories.*` | ✅ except `GET /categories/:slug` ❌ **G-5** |
| **Web — account** (`profile:257,263`, `orders/tracking:170`, `order-confirmation:129,185`) | 5 | `api.account.me`, `api.prescriptions.listMine`, `api.orders.*` | ✅ |
| **Web — cart promo** (`cart/page.jsx:64` → then computes the discount **in the browser**) | 1 | `api.cart.applyPromo()` | ✅ |
| **Web — branches** (`branch-locator:174`, `appointments` `listBranches`) | 2 | `api.branches.list()` | ✅ |
| **Web — customer lookup** (`product/[slug]:103`, `appointments:305,346`, `profile:257`) | 4 | `api.account.me()` | ✅ |
| **Web — reviews** (`product/[slug]:85,113`) | 2 | `api.products.reviews()` | ✅ |
| **Admin — Dashboard / Analytics** via `getDashboardStats`, `getRevenueByPeriod`, `getTopProducts`, `getPaymentMethodBreakdown` | 6 | `api.admin.dashboard()`, `api.admin.analytics()` | 🟡 **G-4, G-8** |
| **Admin — Products** via `listAllProducts` | 1 | needs inactive products | ❌ **G-2** |
| **Admin — Branches:194** | 1 | needs inactive branches | ❌ **G-3** |
| **Admin — Appointments:104, Prescriptions:139, Promotions:75,76** | 4 | `api.admin.*` | ✅ |
| **Admin — Prescriptions:210,211** storage signed URL | 1 | `api.admin.prescriptions.signedUrl()` | ✅ |

### 2.3 API gaps blocking the migration

| Gap | Missing | Blocks | Size |
| --- | --- | --- | --- |
| **G-1** | `PATCH /api/admin/prescriptions/:id` | W16 | XS |
| **G-2** | Admin product list **including inactive** (`GET /products` is `@Public()`, active-only) | Admin Products read | XS |
| **G-3** | Admin branch list **including inactive** | Admin Branches read | XS |
| **G-4** | Payment-method breakdown on dashboard/analytics | Admin Dashboard pie chart | S |
| **G-5** | `GET /api/categories/:slug` | Category SSR metadata | XS |
| **G-6** | `POST /auth/forgot-password`, `POST /auth/reset-password` | *Optional — see §5* | S |
| **G-7** | **SSR-capable api-client** — `web/lib/api.js` is `'use client'`, so Server Components cannot use it | **All of Wave 4** | S |
| **G-8** | Dashboard/analytics response-shape mismatch — API returns `kpis.totalRevenueKes`, `dailyRevenue[].date`; components expect `@optex/db`'s `revenueMonth`, `label` | Admin Dashboard/Analytics | S (adapter) |

**G-7 is the one to not underestimate.** Every Server Component conversion depends on it, and nothing else does. Build it early even though nothing in Waves 1–3 needs it.

---

## 3. Migration sequence

Five waves. Ordered by risk retired per unit of effort, not by tidiness.

### Wave 0 — Prerequisites *(before any migration)*

| Task | Why |
| --- | --- |
| **CI: typecheck + build + API e2e on every PR** | 17 call sites are about to be rewritten with no regression protection. Three criticals already shipped marked ✅ because nothing tested them |
| **Smoke suite: shop → PDP → cart → checkout** | The specific paths Waves 2–4 touch |
| **Build G-1** | The only missing write endpoint |

**Do not start Wave 1 without CI.** This is the same prerequisite [ROADMAP D.3](ROADMAP.md) sets for the render rewrite, and the code review is the evidence for why it matters.

### Wave 1 — Kill all 17 writes ✅ **DONE (2026-08-07)**

**Highest severity, smallest diff, 16 of 17 endpoints already exist.**

> **Status: all 17 writes migrated and VERIFIED against a running stack (2026-08-07).** All three flows pass end to end. Verification found three further defects, now fixed, plus one open RLS bypass, now closed by migration `0009`. See [§10](#10-wave-1-completion-record).

| Order | Site | Fixes |
| --- | --- | --- |
| 1 | **W1** — web appointments | **The critical one.** Customer booking gains branch-hours, slot-grid and double-booking validation for the first time |
| 2 | **W6–W8** — admin appointments | Closes the admin reschedule bypass. With W1, both booking paths are validated |
| 3 | **W2–W4** — CartContext | Cart writes gain `CartService` validation |
| 4 | **W5** — product review | Gains moderation status, duplicate guard, verified-purchase check |
| 5 | **W9–W11** — admin products | Removes the `as any` at `:254`; gains DTO validation and slug generation |
| 6 | **W12–W15** — admin promotions | Gains promo validation and `increment_promo_uses` invariants |
| 7 | **W16** — admin prescriptions | Needs G-1 |
| 8 | **W17** — admin branches | Gains `opening_hours` validation, which the slot engine depends on |

**Free feature en route:** `POST`/`DELETE /api/admin/promo-banners` already exist but `Promotions.tsx` has no banner create/delete UI. Wire it while you are in the file.

**Exit:** zero write operations reach Supabase from a browser. Every business rule is enforced in exactly one place.

### Wave 2 — Admin reads ✅ **DONE (2026-08-07)**

Needed **G-2, G-3, G-4, G-8** plus **G-9**, all built. See [§12](#12-wave-2-completion-record).

Dashboard → `api.admin.dashboard()` · Analytics → `api.admin.analytics()` (close the hardcoded `categoryPerformance` fixture while in there) · plus the read halves of every Wave-1 page.

**Exit:** `grep -rn "@optex/db" apps/admin/components/` returns nothing. Admin is fully on the API.

### Wave 3 — Web account & cart reads

All endpoints exist. Mechanical.

`cart` promo → `api.cart.applyPromo()` — **removes the browser-side discount maths** · `profile`, `orders/tracking` → `api.orders.*` · `order-confirmation` → `api.orders.get` / `api.payments.mpesaQuery`, **replacing the 5-second database poll** · `branch-locator` → `api.branches.list()` · the four `customers` lookups → `api.account.me()`.

**Also:** drop the raw Supabase client from `AuthContext.js:33`, which currently lets every descendant component issue arbitrary queries with the user's token. That leak is *why* this debt keeps returning.

### Wave 4 — Web catalogue reads + render mode

Needs **G-5** and **G-7**. The only wave that is more than a refactor.

`shop`, `product/[slug]`, `category/[slug]`, `search` and the three home components become **Server Components** calling the API server-side, with `generateMetadata` and server-rendered JSON-LD. Interactive parts split into small `'use client'` children. `category/[slug]` is the existing template.

**Do this as the TypeScript conversion.** These files are being rewritten anyway; `.jsx` → `.tsx` costs little extra here and is otherwise a hard sell as standalone work.

**This wave is [SPEC-03](specs/SPEC-03-storefront-seo-render.md).** It is both the migration's end state and the contracted SEO deliverable. One piece of work, two obligations.

### Wave 5 — Lock the door

| Task | Effect |
| --- | --- |
| ESLint `no-restricted-imports` banning `@optex/db` outside the auth allowlist | A PR reintroducing a browser query fails CI |
| `typecheck` script on `apps/web` | Contract changes become build errors |
| **Delete the write helpers from `packages/db/src/queries/`** | `createAppointment`, `addCartItem`, `updateCartItemQuantity`, `removeCartItem`, `createOrder`, `updateOrderStatus` |

**That last item is the one that actually prevents recurrence.** Lint rules are bypassable and get disabled under deadline pressure. A function that no longer exists cannot be called. The read helpers can stay until Wave 4 removes their callers; **the write helpers should be deleted the moment Wave 1 lands.**

---

## 4. Where this stops — and why

After all five waves, **~12 files still touch Supabase. All of them handle sessions.**

`web/middleware.js` · `admin/middleware.ts` · `web/lib/api.js` · `admin/lib/api.ts` · `web/context/AuthContext.js` · the four web auth pages · `admin/app/login/page.tsx` · `admin/components/layout/AdminSidebar.tsx`

**That residue should stay.** Three structural reasons:

1. `@optex/api-client` has **no session store**. Only `createBrowserSupabase()` plus the `@supabase/ssr` cookie bridge persist and silently refresh the JWT. `POST /api/auth/refresh` exists and nothing calls it.
2. `admin/middleware.ts:34` gates every admin route on `app_metadata.role` at the **Edge**, where the client-only `lib/api.ts` cannot reach.
3. Password reset has no API equivalent (G-6).

**None of these files read or write a domain table.** They hold sessions, not business rules, so none can bypass a business rule — which is the actual goal. Reaching literal zero would need httpOnly-cookie session endpoints, G-6, and Edge JWT verification without the Supabase SDK: real risk, on a system taking live payments, traded for architectural tidiness.

**Recommendation: stop at auth.** Revisit only if the Flutter app needs a cookie-free session model — the one scenario that would justify it.

`admin/app/login/page.tsx` already shows the correct hybrid: it calls `api.auth.login()` for authentication, then bridges the returned session into the Supabase client for cookie management. **Authenticate through the API; let Supabase hold the session.**

---

## 5. One RLS change this forces

`packages/db/src/queries/appointments.ts:25-28` documents the current policy:

> *"RLS allows authenticated customers to book for themselves, and also allows anon inserts when customer_id is null (guest bookings — required by the SOW)."*

The client has now decided **an account is required for appointments** ([CLIENT-ANSWERS B4](CLIENT-ANSWERS.md)). That anon-insert policy is contrary to the decision and must be dropped in the same migration.

More broadly: once all writes go through the service-role API, **RLS should be tightened to deny-by-default for writes** on every domain table. It stops being the enforcement layer and becomes defence-in-depth — which is what [CLAUDE.md](../CLAUDE.md) already says it is, but is not currently true for appointments, cart items or reviews.

---

## 6. Effort and sequencing

| Wave | Size | Blocked on | Value |
| --- | --- | --- | --- |
| **0** Prerequisites | S | Nothing | Makes everything else safe |
| **1** All 17 writes | **M** | G-1 only | **Highest. Closes a critical booking bypass and 16 validation gaps** |
| **2** Admin reads | M | G-2, G-3, G-4, G-8 | Admin fully backend-owned |
| **3** Web account/cart reads | M | Nothing | Removes browser discount maths and the 5s poll |
| **4** Catalogue + render | **L** | G-5, G-7, **Wave 0** | Also delivers the contracted SEO obligation |
| **5** Enforcement | S | Waves 1–4 | Prevents recurrence |

**Waves 1 and 3 are unblocked today.** Wave 1 is where the risk is and where the endpoints already exist — it should start first and it should not be split across sprints, because a half-migrated write path is worse than either end state.

**Rough shape:** Wave 0 + Wave 1 in one sprint. Waves 2 and 3 in a second. Wave 4 is [SPEC-03](specs/SPEC-03-storefront-seo-render.md)'s three sprints. Wave 5 is a day, at the end.

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Migrating writes surfaces validation that was never enforced** — bookings, promos or products that the API will now correctly reject | **High** | Existing data looks broken | **Expect this. It is the point.** Audit existing appointments for out-of-hours and double-booked rows *before* Wave 1, so the fix is a data cleanup rather than a support incident |
| Wave 4 regresses the storefront | Medium | Customer-facing | Wave 0's smoke suite is a hard prerequisite. One page per PR. Pair on the first |
| Query helpers get reintroduced | Medium | Debt returns | **Delete the write helpers** rather than relying on lint |
| Latency regression — API hop replaces a direct query | Low | Perceived slowness | Wave 4 moves reads server-side, which is *faster* than the browser round-trip it replaces. Measure `shop` and PDP before and after |
| Cart migration breaks an active session's cart | Medium | Lost carts | Carts are server-persisted already; the write path changes, not the storage. Test with a populated cart across the deploy |
| G-7 underestimated, stalling Wave 4 | Medium | SEO deliverable slips | Build G-7 during Wave 1, not when Wave 4 needs it |

---

## 8. Definition of done

- [ ] `grep -rn "@optex/db" apps/admin/components/ apps/admin/app/` returns nothing outside `login/page.tsx` and `AdminSidebar.tsx`
- [ ] `grep -rn "@optex/db" apps/web/app/ apps/web/components/ apps/web/context/` returns nothing outside `AuthContext.js` and the four auth pages
- [ ] No `.from(`, `.rpc(` or `.storage` call exists in any component in either app
- [ ] The write helpers are **deleted** from `packages/db/src/queries/`
- [ ] ESLint fails a PR that reintroduces a `@optex/db` import outside the allowlist
- [ ] `apps/web` has a passing `typecheck` script, running in CI
- [ ] A customer cannot book an out-of-hours, misaligned or double-booked appointment through **any** path
- [ ] The anon-insert RLS policy on `appointments` is dropped
- [ ] Cart totals shown to the customer are always server-computed

---

## 9. The one thing worth saying

This is not a refactor for its own sake. The API already contains the correct business rules — slot validation, review moderation, promo invariants, DTO validation, atomic checkout. **Those rules are currently bypassed on 17 write paths**, including the primary customer appointment booking, which has no validation at all.

The instruction *"everything should come from the backend"* is not an architectural preference. It is the difference between having business rules and enforcing them.

---

## 10. Wave 1 completion record

**Date:** 2026-08-07 · **Verified by:** `pnpm -r typecheck` (clean), `pnpm --filter @optex/web build` (clean), call-site greps.

### Writes migrated — 17 of 17

| # | Site | Now calls |
| --- | --- | --- |
| W1 | `web/app/appointments/page.jsx` | `api.appointments.create()` |
| W2–W4 | `web/context/CartContext.js` | `api.cart.{addItem,updateItem,removeItem}()` |
| W5 | `web/app/product/[slug]/page.jsx` | `api.reviews.create()` |
| W6–W8 | `admin/…/Appointments.tsx` | `api.admin.appointments.update()` |
| W9–W11 | `admin/…/Products.tsx` | `api.admin.products.{create,update,remove}()` |
| W12–W15 | `admin/…/Promotions.tsx` | `api.admin.{promos,banners}.*` |
| W16 | `admin/…/Prescriptions.tsx` | `api.admin.prescriptions.updateStatus()` |
| W17 | `admin/…/Branches.tsx` | `api.admin.branches.update()` |

### Built along the way

- **G-1** — `PATCH /api/admin/prescriptions/:id`, plus `UpdatePrescriptionStatusDto` and `PrescriptionsService.updateStatusAsAdmin()`. `processed_at` is derived server-side from the status so the two can never disagree.
- **api-client** — `admin.prescriptions.updateStatus()`; `Prescription.status` narrowed from `string` to the `pres_status` union.

### Write helpers deleted from `packages/db`

`cart.ts` removed entirely; `createAppointment`, `createOrder`, `updateOrderStatus` removed. Each file now documents which API endpoint replaced it. **This is what prevents recurrence** — a function that does not exist cannot be called, whereas a lint rule can be disabled.

### Three defects fixed that were not in the original register

1. **Customer booking never validated anything** ([CODE-REVIEW H-3](CODE-REVIEW.md)). The page also generated its own 09:00–17:30 slot list, so it offered times the branch was closed and slots already taken. It now reads real availability from `GET /appointments/slots` and books through the API.
2. **The admin reschedule dialog had its own hardcoded 09:00–16:00 list**, with an accidental gap at 12:30. Now wired to real availability for that branch and date.
3. **`Branches.tsx` was corrupting `branches.hours`.** It read `hours.weekday/.saturday/.sunday` — keys that never exist in real data, which is `{mon:["09:00","18:00"], sun:null}` — displayed placeholders, then wrote that invented shape back. **Any admin who opened a branch and saved destroyed its per-weekday hours, breaking appointment booking for that branch entirely.** Read and write now both use the real schema shape.

### Error handling

Every migrated write previously swallowed failures into `console.error`. They now surface the API's message, because rejections are expected outcomes rather than bugs — "That slot is already booked", "The branch is closed on the requested date". Optimistic updates roll back on failure, and dialogs stay open with the form intact.

### Not done — deliberately

- **Reads still hit Supabase** in both apps. That is Waves 2–4.
- **Gap G-9 (new):** `GET /admin/appointments` returns no joined customer or branch names, so the admin list read cannot migrate until it does. Same shape of fix as the Reviews endpoint in `0d2233f`. Add to the Wave 2 gap list.
- **Not exercised against a running stack.** Docker was unavailable, so this is verified by typecheck, build and static analysis only. **Before merge, run the three flows below.**

### Required manual verification before merge

1. **Customer booking** — book a slot; confirm only real available times are offered, that a taken slot disappears, and that booking while signed out redirects to login.
2. **Admin reschedule** — attempt to move a booking onto an occupied slot; confirm it is rejected with a readable message and the dialog stays open.
3. **Branch hours** — open a branch, save without changes, then confirm appointment slots still generate for it. This is the regression that the old code caused silently.
4. **Audit existing data first:** `branches.hours` rows may already be corrupted by the old editor, and `appointments` may contain out-of-hours or double-booked rows that the API would now reject.

---

## 11. Runtime verification — 2026-08-07

Docker stack up, migrations applied, all three apps running. Every assertion below was executed, not inferred.

### Flow 1 — customer booking ✅

| Assertion | Result |
| --- | --- |
| Slots derive from real branch hours | 18 on a Monday (09:00–17:30); **0 on Sunday** (branch closed) |
| Booking a free slot | `201` |
| Booked slot leaves availability | 18 → 17, `10:00` gone |
| Double-booking the same slot | **`409` "That slot is already booked"** |
| Booking outside opening hours (03:00) | **`400`** |
| Booking on a closed day | **`400` "The branch is closed on the requested date"** |
| Booking off the 30-min grid (10:17) | **`400`** |
| Booking without an account | **`401`**, and the UI redirects to `/login?redirect=/appointments` |
| Storefront UI shows real availability | 16 slots, with booked `11:00`/`14:00` absent |

### Flow 2 — admin reschedule ✅

| Assertion | Result |
| --- | --- |
| Reschedule onto an occupied slot | **`409`**, dialog stays open with the message |
| Reschedule outside opening hours | **`400`** |
| Reschedule onto a closed day | **`400`** |
| Reschedule onto a free slot | `200` |
| Non-admin attempting the same call | **`403` "Insufficient permissions"** |
| Dialog offers real availability | Shows "Pick a date first", then live slots — no hardcoded list |

### Flow 3 — branch hours ✅ *(after fixing a blocker — see below)*

| Assertion | Result |
| --- | --- |
| Editor displays real hours | `09:00 - 19:00` / `10:00 - 18:00` / `Sun: Closed` — previously `—` placeholders |
| Save unchanged via the UI | `200`, `hours` byte-identical, slots still generate (20) |
| The old corrupt shape (`{weekday,saturday,sunday}`) | **`400` rejected by the API** |

### Three further defects found during verification, now fixed

1. **Branch save was blocked for every branch.** The seeded phone format `+254 700 000 002` failed the API's `^(\+?254|0)[17]\d{8}$` regex, so *any* admin saving *any* branch got "phone must be a valid Kenyan mobile number" — even without touching the phone. This would have hit all 27 real branches. Fixed with a `@Transform` that strips spaces, hyphens and brackets before validation; genuinely invalid numbers are still rejected. **My first Flow 3 pass was a false positive** — the hours survived because the write was *rejected*, not because it round-tripped. Caught by reading the browser console rather than trusting the DB diff.

2. **`getTopProducts` was permanently broken.** It filtered on `order_items.created_at`, a column that does not exist, so the query returned `42703` on every dashboard load and "Top Products" always rendered empty regardless of sales. Fixed by filtering through the parent order with an inner join.

3. **The RLS write bypass was still wide open** — see below.

### The bypass Wave 1 did *not* close, now closed by `0009`

Migrating the callers did not close the bypass. The anon key ships in the browser bundle by design, so with a customer login these all succeeded **before** migration `0009`:

| Direct PostgREST write | Before | After |
| --- | --- | --- |
| `appointments` INSERT (authenticated) | `201` | **`403`** |
| `appointments` INSERT (**anonymous**) | `201` | **`401`** |
| `appointments` UPDATE | allowed | **0 rows affected** |
| `product_reviews` INSERT with `status:'approved'` | `201` — **publicly visible, moved the aggregate rating** | **`403`** |
| `carts` / `cart_items` INSERT (quantity 9999) | `201` | **`403`** |
| `products` / `branches` / `promo_codes` | `403` already | `403` |

Customer reads are unchanged (`200` for own appointments, own cart, public reviews), and the API — which uses the service-role client — is unaffected:

| Post-lockdown regression check | Result |
| --- | --- |
| Book via API | `201`, double-book still `409` |
| Add to cart via API | `201`, subtotal 64,000 → total 74,240 (16% VAT correct) |
| Create review via API | `201` with `status: pending` — **moderation now actually enforced** |
| Admin reschedule via API | `200` |
| Storefront UI booking | 15 slots, all three booked times absent |

`0009` also drops the anonymous appointment INSERT policy, which contradicted the client's account-required decision (B4).

### Still open after Wave 1

| Item | Where |
| --- | --- |
| **G-9** — `GET /admin/appointments` returns no joined customer/branch names | Wave 2 |
| Admin list shows "Guest" for accounts with no `full_name` set | Cosmetic; misleading now that guest booking is gone |
| Dashboard "Payment Methods" pie is a hardcoded 64/28/8 fixture | Wave 2 (gap G-4) |
| All reads still on Supabase in both apps | Waves 2–4, as planned |
| Branch phones now canonicalise on save (spaces stripped) | Expected; data converges as branches are edited |

---

## 12. Wave 2 completion record

**Date:** 2026-08-07 · Verified against the running stack.

### Exit criterion met

`grep -rn "@optex/db" apps/admin/components/` returns one line: `AdminSidebar.tsx`'s `signOut`. That is the auth residue [§4](#4--where-this-stops--and-why) says should stay. No admin component issues a Supabase query, `.rpc`, or `.storage` call.

### Gaps built

| Gap | Built |
| --- | --- |
| G-2 | `GET /products/admin/all` — includes inactive |
| G-3 | `GET /branches/admin/all` — includes inactive |
| G-4 | `paymentMethods[]` on the dashboard |
| G-8 | `snapshot{}` on the dashboard — calendar KPIs alongside the range-scoped ones |
| G-9 | `GET /admin/appointments` resolves customer + branch names |

G-2 and G-3 are separate admin routes, not flags on the existing `@Public()` ones: a public endpoint must not widen its result set based on a token it never verifies.

### Both hardcoded fixtures removed

- **Dashboard payment pie** — was a literal `64% / 28% / 8%` rendered regardless of sales. Now real; verified showing 50/50 against two seeded orders.
- **Analytics category chart** — was six invented categories with invented growth percentages. Now real revenue by category, with growth computed against the preceding equal-length window. Returns `null` (rendered "new") when there is no prior data rather than a misleading 0%.

### Verified in the browser

| Check | Result |
| --- | --- |
| All seven admin pages load | ✅ |
| Payment breakdown | M-Pesa 50% / Pesapal 50% — the 64/28/8 fixture is gone |
| Dashboard KPIs | Ksh 18,000 MTD, 2 orders today, 4 customers — all real |
| Deactivated product (G-2) | Still listed, badged **Inactive** |
| Appointments (G-9) | "Amina Wanjiru · 0712000111 · Nairobi CBD" — names, not uuids |
| Branch hours | Real per-weekday ranges |

### Defects found during Wave 2

1. **Products requested `limit=200`, exceeding the DTO cap of 100** — a 400 swallowed by `console.error`, leaving the grid empty. Now pages to exhaustion, because the grid filters client-side and a truncated page would silently hide products rather than show fewer.
2. **Two more PostgREST filter injections**, same class as the confirmed one on the payments path ([CODE-REVIEW C-2](CODE-REVIEW.md)): `branches.service.ts` and `products.service.ts` escaped the `ilike` wildcards but not PostgREST's own delimiters. `customers.service.ts` already did this correctly and was the model. Both fixed.

Typechecking also surfaced two shape differences the untyped Supabase path had hidden: the API is camelCase where db rows were snake_case, and `products.category_id` is genuinely nullable. Fixed at the call sites rather than cast away.

### Still open

| Item | Where |
| --- | --- |
| **C-2** — the payments-path injection itself | [SPEC-01 R3](specs/SPEC-01-payment-integrity.md), still P0 and unimplemented |
| All storefront reads | Waves 3–4 |
| `apps/web` has no `typecheck` script | Wave 5 |
| ESLint `no-restricted-imports` not yet added | Wave 5 |
