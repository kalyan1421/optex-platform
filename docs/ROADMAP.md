# OPTEX — State of Play & Forward Plan

**Date:** 2026-08-03
**Supersedes:** `docs/PLAN.md` (2026-05-21) for sequencing; `docs/MISSING_FEATURES.md` (2026-07-22) for status
**Inputs:** `Optex_Client_Input_Form filled.xlsx`, `Optex_Client_Input_Form Business model.xlsx`, direct code inspection of `development` @ `0d2233f`

---

## 0. Executive summary

Three things are true at once, and the existing docs only say the first:

1. **The backend is essentially done.** `apps/api` has 24 controllers exposing **68 routes** across 20 services, covering every Phase 1A domain, and `@optex/api-client` exposes 1,900 lines of typed contract for it. This is genuinely strong work.
2. **The frontends have not caught up.** The storefront is 38 untyped `.jsx` files that still read and write Supabase directly from the browser. Admin is ~60% migrated (4 of 12 pages moved to the API in the last 3 commits). The API exists but is largely unused by the apps it was built for.
3. **The client's input form unblocks payments but blocks almost everything else.** Sections 2 and 3 came back answered (business model, 27 branches). Sections 1, 4 and 5 — product catalogue, appointment slot rules, and *all* CR-01 decisions — came back **completely blank**.

The correct next move is **not** to start CR-01. It's to finish the API migration, close the SEO/render gap, and get the catalogue in — while chasing the client on the three blank sections.

---

## Part A — What the client input form actually told us

### A.1 Answered (Sections 2 & 3)

| Area | Client answer | Impact on build |
| --- | --- | --- |
| Pricing model | **Single MRP** | ✅ Simplifies — no branch-price table needed. Confirms current schema. |
| Discounts / promos | **N/A** (none) | ⬇️ Deprioritise the promotions engine for launch. Keep the code, hide the UI. |
| Delivery | **Store pickup + 3rd-party Wells Fargo** | ⚠️ **New requirement.** Checkout needs a *pickup-station picker*, not a street-address form. |
| Free-delivery threshold | Above **$39**, Nairobi only, at Wells Fargo stations | ⚠️ Needs geo-scoped shipping rules. Not currently modelled. |
| Returns / refunds | **No refunds** | ✅ Drops the returns module. Still need the policy page to say so plainly. |
| VAT | **Registered, 16%** | ✅ `orders.vat_kes` already exists. |
| eTIMS (KRA e-invoice) | **Yes — required** | 🔴 **New scope.** Not in the SOW, not in the schema, not built. See A.3. |
| Base lens pricing | From **$28** | ⚠️ Needs a lens configurator + price tiers. Not built. |
| Coating add-ons | From **$20** | ⚠️ Same — add-on pricing model absent. |
| Eye test fee | **Free** | ✅ Big simplification — no payment-at-booking, no deposit flow. |
| Advance deposit | **No** | ✅ Confirms above. |
| Payment methods | M-Pesa / Card / Pesapal | ✅ Matches build. |
| **M-Pesa Daraja creds** | **Ready** | 🟢 **Unblocks work item #20.** |
| **Pesapal KYC** | **Merchant account active** | 🟢 **Unblocks work item #21.** |
| COD | **Not offering** | ⚠️ Remove COD from checkout — it's currently an option. |
| Branches | **27 supplied** with addresses, hours, managers | ✅ Ready to seed. Only 4 have Google Maps links. |
| Stock | **Central**, reconciled **monthly** | ✅ Simplifies the CR-01 ledger — single stock pool. |
| Play Console | **Not created** | 🔴 Blocks Phase 2 Android submission. $25, client action. |
| Google Maps API key | **No** | 🔴 Blocks branch-locator maps. |
| Hosting | **Client managed** | ⚠️ Changes the deploy runbook. Needs a decision session. |
| SPOC | **Paul** (no email given) | ⚠️ Need the email address. |

### A.2 Blank — and what each blank blocks

| Section | Status | Blocks |
| --- | --- | --- |
| **1 — Product Catalogue** | Empty. Zero SKUs. Variant rules and photography questions unanswered. | **Launch.** No catalogue = no store. Also blocks CR-01.4 (cost price per SKU). |
| **4 — Appointment System** | **Entirely blank.** No slot duration, no working days, no concurrency, no buffer, no doctor list. | Appointments can't be configured per branch. `assertSlotBookable()` reads branch hours we don't have. Blocks all of CR-01.5. |
| **5 — CR-01 Decisions** | **Entirely blank** — including the one marked "CRITICAL — ANSWER FIRST" (Phase 1A+1B split vs combined). | **All of CR-01.** 13 of the 14 open decisions in `PLAN.md §8` remain open. |

**Read this plainly:** CR-01 cannot be planned, quoted, or started. Anyone proposing to begin it now would be guessing at the requirements.

### A.3 Conflicts to resolve with the client

| # | Conflict | Why it matters | Recommendation |
| --- | --- | --- | --- |
| **C-1** | **Currency: client wrote "Dollars"** and quoted $39 / $28 / $20. SOW, schema (every column is `*_kes`), and M-Pesa are all **KES-only**. | M-Pesa Daraja settles in KES. A USD storefront cannot take M-Pesa. This is not a display preference — it's structural. | Confirm KES as the transaction currency. If they want USD *display*, that's a presentation-layer conversion, and someone must own the FX rate. **Ask before anything else.** |
| **C-2** | **eTIMS is "Yes"** but appears nowhere in the SOW, schema, or code. | KRA e-invoicing is a legal requirement for VAT-registered traders. Shipping without it exposes Optex to compliance risk. | Treat as a **change request (CR-02)**, scoped and quoted separately. Do not absorb silently into Phase 1A. |
| **C-3** | **Wells Fargo pickup-station delivery** replaces doorstep courier. | Checkout currently collects a delivery address. The real model is "pick a station." Different UX, different data model, different shipping-rule logic. | Scope as a Phase 1A change. Needs the station list from the client. |
| **C-4** | The two spreadsheets **disagree**. `filled.xlsx` Section 2 has numbers in the wrong cells ("Pricing model? → 54", "Base lens → 27", "Currency → Dollars"). `Business model.xlsx` is clean and coherent. | Building from the wrong file produces garbage. | **Treat `Business model.xlsx` as authoritative** for Section 2 (it is the version I've used above). Get the client to confirm. |

---

## Part B — Actual code state, corrected

The existing docs overstate completion in three specific places. Correcting them, with evidence:

| Doc claim | Reality | Evidence |
| --- | --- | --- |
| "Server Components read Supabase directly for SSR/SEO pages" (`CLAUDE.md`) | The two highest-value SEO pages are **client components**. PDP fetches product data in `useEffect` from the browser. | `apps/web/app/product/[slug]/page.jsx:1` — `'use client'`; data fetch at `:80`; JSON-LD injected client-side at `:357`. No `generateMetadata` anywhere in the app. |
| "PDP with JSON-LD ✅ / SEO complete" | JSON-LD renders **after hydration**. There are no per-product `<title>` or OG tags. 16 of 22 pages are `'use client'`. | Same file. `generateMetadata` count across `apps/web`: **0**. |
| "All 12 admin pages real, only two small gaps" | True for *data*, but **7 of 12 still write to Supabase directly from the browser**, bypassing the API's validation and side-effects. | 13 write sites — see B.2. |

### B.1 What is genuinely done and good

- `apps/api` — 24 controllers / 68 routes, 20 services, 13 modules. Atomic `place_order` RPC. M-Pesa + Pesapal + webhooks + reconcile. SMS/email. Cron jobs. Swagger at `/api/docs`. `pnpm -r typecheck` clean.
- `@optex/api-client` — 867 lines of client, 1,055 of types. Covers essentially the whole surface, customer *and* admin.
- Auth privilege escalation (S-7) — closed and verified across all three checkpoints.
- 8 migrations with RLS on every table; Docker dev stack that actually works.
- Checkout is **already fully on the API** (`checkout/page.jsx:217` onward) — proof the migration pattern works end to end.
- Admin Orders, Customers, Inventory, Reviews — migrated in the last 3 commits.

### B.2 The core problem: 13 browser-side writes bypassing the API

Every one of these calls Supabase directly from the browser, authorised only by RLS. The API has an endpoint for each — with validation and side-effects these calls skip.

| File:line | Write | What the API path does that this skips |
| --- | --- | --- |
| `web/app/product/[slug]/page.jsx:136` | `product_reviews.insert` | `POST /api/products/:id/reviews` — moderation status, duplicate-review guard, verified-purchase check |
| `admin/components/admin/Appointments.tsx:211` | `.update({status:'rescheduled', scheduled_at})` | **`assertSlotBookable()`** — branch-hours check, slot-grid alignment, **double-booking guard** (`appointments.service.ts:251-274`) |
| `admin/.../Appointments.tsx:165,186` | confirm / cancel | `updateForAdmin()` validation + status transition rules |
| `admin/.../Products.tsx:254,271,288` | product insert / update / deactivate | DTO validation, slug generation, `is_active` cascade. Note the **`as any` cast at :254** — type safety defeated |
| `admin/.../Promotions.tsx:120,132,145,157` | promo code + banner CRUD | `promotions.service` validation, `increment_promo_uses` invariants |
| `admin/.../Prescriptions.tsx:189` | `.update({status:'processed'})` | Ownership + audit path in `prescriptions.service` |
| `admin/.../Branches.tsx:216` | branch update | `UpdateBranchInput` validation — including the `opening_hours` JSON the slot engine depends on |

**`Appointments.tsx:211` is a live bug, not a style issue.** An admin rescheduling a booking can double-book a slot or place it outside branch opening hours, because the browser write skips `assertSlotBookable()` entirely. The API rejects exactly this.

### B.2a Three more browser-side issues worth naming

| Issue | Location | Why it matters |
| --- | --- | --- |
| **Promo discount computed in the browser** | `web/app/cart/page.jsx:62-89` — reads `promo_codes` directly, then does the discount maths client-side | `POST /api/promo/validate` and `POST /api/cart/apply-promo` both exist. Checkout recomputes server-side, so this is not currently exploitable for money — but the cart shows a number the server never blessed, and the two can disagree. |
| **Raw Supabase client leaked into React context** | `web/context/AuthContext.js:33` | Every descendant component can issue arbitrary queries with the user's token. It makes TD-1 structurally easy to reintroduce. |
| **Browser polls the DB every 5s, up to 24 times** | `web/app/order-confirmation/[orderId]/page.jsx:175-192` | Direct `orders.payment_status` polling per waiting customer. `api.payments.mpesaQuery` / `api.orders.get` exist. |

Also dead weight: `web/app/api/contact/route.ts` duplicates `POST /api/contact` on Nest. Two Resend integrations, one contact form. Delete one.

### B.3 Full direct-Supabase inventory

**`apps/web` — 22 files.** Every data-bearing page. Only `lib/api.js` touches `@optex/api-client`, and only `checkout` consumes it.

`shop`, `product/[slug]`, `category/[slug]`, `search`, `cart`, `profile`, `orders/[id]/tracking`, `order-confirmation/[orderId]`, `appointments`, `branch-locator`, `components/home/{FeaturedCollection,FeaturedProducts,TrendingNow}`, `context/{AuthContext,CartContext}`, plus the five auth pages and `middleware.js`.

**`apps/admin` — 7 data pages + 4 auth/infra files.**

Remaining: `Analytics`, `Appointments`, `Branches`, `Dashboard`, `Prescriptions`, `Products`, `Promotions`.
Already migrated: `Orders`, `Customers`, `Inventory`, `Reviews`.
Auth-legitimate: `login/page.tsx`, `middleware.ts`, `AdminSidebar.tsx`, `lib/api.ts`.

**Auth is the one justified exception.** `@supabase/ssr` cookie-session handling in `middleware.*` and the auth pages should stay on the Supabase client — the API's `/auth/*` endpoints exist but swapping cookie management mid-flight is a separate, riskier change. Keep Supabase for *session*, move everything else to the API.

---

## Part C — Tech debt register

Scored per `Priority = (Impact + Risk) × (6 − Effort)`, all 1–5.

| ID | Item | Type | I | R | E | **Pri** | Business justification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **TD-1** | 13 browser-side Supabase writes bypass API validation | Architecture | 5 | 5 | 3 | **30** | Live double-booking bug. Business rules exist in one place and are enforced in neither. Every future rule must be written twice. |
| **TD-2** | No CI, no tests beyond 1 smoke spec | Test / Infra | 5 | 5 | 3 | **30** | 27 commits, zero automated regression protection, on a system that takes money. |
| **TD-3** | Storefront is client-rendered → SEO + CWV gap | Architecture | 5 | 4 | 3 | **27** | SEO and Core Web Vitals are **contracted SOW deliverables**. Currently unmet on the pages that matter most. |
| **TD-4** | `apps/web` is 38 untyped `.jsx` files, no `typecheck` | Code | 4 | 4 | 4 | **16** | The typed API client's value is thrown away at the boundary. Every API contract change is a runtime surprise. |
| **TD-5** | No ESLint anywhere; `pnpm -r lint` is broken | Code | 3 | 2 | 2 | **20** | A root script that fails is worse than no script — it trains people to ignore red. |
| **TD-6** | Two parallel data-access layers (`@optex/db/queries` + `api-client`) | Architecture | 3 | 3 | 2 | **24** | Ambiguity about which is correct is *why* TD-1 keeps recurring. Resolve by deleting one. |
| **TD-7** | CR-01 schema gaps: no `cost_price`, `suppliers`, `stock_ledger`, `roles`, `audit_log`, `doctors` | Architecture | 3 | 2 | 4 | **10** | Real, but correctly deferred — do not build until Section 5 comes back. |
| **TD-8** | Analytics hardcoded `categoryPerformance`; Customers deactivate disabled | Code | 2 | 2 | 1 | **20** | Small, visible in a client demo, cheap. |
| **TD-9** | Docs overstate completion (Parts B above) | Documentation | 3 | 3 | 1 | **30** | Planning off wrong status is how deadlines are missed. Fixed by this document. |

**Do first:** TD-1, TD-2, TD-3, TD-9. **Do alongside:** TD-5, TD-6, TD-8. **Defer:** TD-4 (fold into TD-1 work), TD-7 (blocked on client).

---

## Part D — "Everything through the API" migration plan

**Target rule:** `apps/web` and `apps/admin` import `@optex/db` **only** for `createBrowserSupabase`/`createServerSupabase` in auth-session code. All data access goes through `@optex/api-client`. Enforced by lint.

The wiring already exists and is proven — `web/lib/api.js` and `admin/lib/api.ts` are identical, correct, and `checkout` already uses it successfully. This is a consumption problem, not a design problem.

### D.0 API gaps that must be built first

A full route audit found **68 HTTP routes across 26 controllers** — the surface is close to complete, but **8 gaps** block a clean migration. Build these before the waves that need them.

| # | Missing endpoint | Blocks | Size |
| --- | --- | --- | --- |
| G-1 | `PATCH /api/admin/prescriptions/:id` (mark processed) | Wave 1 | XS |
| G-2 | Admin product list **including inactive** — `GET /api/products` is `@Public()` and active-only | Wave 2 | XS (query flag) |
| G-3 | Admin branch list **including inactive** — `branches.service.findActive()` is active-only | Wave 2 | XS |
| G-4 | Payment-method breakdown — `DashboardResponse`/`AnalyticsResponse` carry none, but the admin pie chart needs it | Wave 2 | S |
| G-5 | `GET /api/categories/:slug` — only the full list exists; SSR metadata needs one category | Wave 5 | XS |
| G-6 | `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` | Optional (see D.4) | S |
| G-7 | **SSR-capable api-client instance** — `web/lib/api.js` is `'use client'`, so Server Components cannot use it | **Wave 5 — hard prerequisite** | S |
| G-8 | Dashboard/Analytics **response-shape mismatch** — API returns `kpis.totalRevenueKes`, `dailyRevenue[].date`, `topProducts[].revenueKes`; components expect `@optex/db`'s `revenueMonth`, `label`, `revenue` | Wave 2 | S (adapter) |

G-7 is the one to not underestimate. Wave 5 is impossible without it.

### D.1 Sequencing — writes before reads

Writes are where the bugs are. Reads are just refactors.

**Wave 1 — Admin writes (highest severity, smallest diff).** Kill all 13 write sites.
`Appointments` (fixes the double-booking bug) → `Products` (kills the `as any`) → `Promotions` → `Prescriptions` → `Branches`.
Four of the five already exist in `api-client`: `admin.appointments.update`, `admin.products.{create,update,remove,uploadImage}`, `admin.promos.*`, `admin.banners.*`, `admin.branches.update`. **Only G-1 needs building.**

Bonus: `POST/DELETE /api/admin/promo-banners` already exist but `Promotions.tsx` has no banner create/delete UI at all. Free feature — wire it while you're in the file.

**Wave 2 — Admin reads.** Needs G-2, G-3, G-4, G-8 first. `Dashboard` → `admin.dashboard()`, `Analytics` → `admin.analytics()` (close TD-8's fixture chart while in there), plus the read halves of the Wave-1 pages. Admin then has **zero** `@optex/db` imports outside auth.

**Wave 3 — Web writes + cart.** `product/[slug]:136` → `api.reviews.create()`; `appointments` → `api.appointments.create()`; `CartContext.js` → `api.cart.*`; `cart/page.jsx` promo → `api.cart.applyPromo()` (removes the browser-side discount maths). All endpoints exist.

**Wave 4 — Web account reads.** `profile` → `api.orders.list` + `api.prescriptions.listMine` + `api.account.me`, `orders/[id]/tracking` → `api.orders.tracking`, `order-confirmation` → `api.orders.get` / `api.payments.mpesaQuery` (replacing the 5s DB poll), `branch-locator` → `api.branches.list`. All endpoints exist. Also drop the raw client from `AuthContext:33`.

**Wave 5 — Web catalogue reads + render-mode fix (TD-3).** Needs G-5 and G-7 first. This is the one wave that is more than a refactor. `shop`, `product/[slug]`, `category/[slug]`, `search`, and the three home components move to **Server Components** calling the API server-side, with `generateMetadata` per product/category and JSON-LD rendered server-side. Interactive bits (filters, add-to-cart, review form) split into small `'use client'` children. `category/[slug]` is currently the only Server Component in the app — it is the template for the rest.

Do Wave 5 **as the TypeScript conversion** (TD-4) — you are rewriting these files anyway; converting `.jsx` → `.tsx` at the same time costs little extra and is otherwise a hard sell as standalone work.

**Wave 6 — Enforce.** Add ESLint with `no-restricted-imports` banning `@optex/db` outside `**/middleware.*`, `**/lib/api.*`, and the auth pages. Add `typecheck` to `apps/web`. This is what stops the debt returning.

### D.2 Why this order

Wave 1 fixes a real bug with no API work. Waves 2–4 are mechanical and build confidence. Wave 5 carries the actual risk and is also the SOW-deliverable fix (SEO/CWV), so it deserves the most runway. Wave 6 is worthless before the others and essential after.

### D.3 Prerequisite

**Do TD-2 (CI + tests) before Wave 5, not after.** Rewriting the storefront's render model with zero regression protection is the single riskiest thing on this plan. A smoke suite covering shop → PDP → cart → checkout is enough; it does not need to be comprehensive, it needs to exist.

### D.4 Where "everything through the API" stops — and my recommendation

After all six waves, **12 files still touch Supabase, all auth-only**: both `middleware.*`, both `lib/api.*`, `web/context/AuthContext.js`, the four web auth pages, `admin/app/login/page.tsx`, `admin/components/layout/AdminSidebar.tsx`.

That residue is unavoidable without further work, for three structural reasons:

1. `@optex/api-client` has **no session store**. Only `createBrowserSupabase()` + the `@supabase/ssr` cookie bridge persist and silently refresh the JWT. `POST /api/auth/refresh` exists but nothing calls it.
2. `admin/middleware.ts:32-46` gates every admin route on `app_metadata.role` at the **Edge**, where the client-only `lib/api.ts` cannot reach.
3. Password reset has no API equivalent at all (G-6).

Reaching literal zero would need httpOnly-cookie session endpoints (`POST`/`DELETE /api/auth/session`), G-6, and an Edge middleware that verifies the JWT without the Supabase SDK.

**My recommendation: don't.** Stop at auth-only. The 12 remaining files hold *sessions*, not business data — none of them read or write a domain table, so none of them can bypass a business rule. That is the actual goal. Going further trades real risk (rewriting auth on a system taking live payments) for architectural tidiness. Revisit it only if the Flutter app needs a cookie-free session model, which is the one scenario that would justify it.

Note both `middleware.*` files construct `createServerClient` from `@supabase/ssr` with raw env vars, bypassing `@optex/db` entirely — so `@supabase/ssr` stays a direct dependency of both apps regardless.

---

## Part E — Feature roadmap

### E.1 Sprint N+1 — Unblock and de-risk

1. **Client conversation on C-1…C-4.** Currency first — it gates everything commercial.
2. **API gaps G-1 … G-4, G-8** (all XS/S).
3. **Wave 1 + Wave 2** — admin fully on the API, zero business-data Supabase calls. Closes TD-8 en route.
4. **CI pipeline** + storefront smoke tests (TD-2).
5. **ESLint** (TD-5) — config only; enforcement lands in Wave 6.
6. **Seed the 27 branches** from Section 3. Real data beats fixtures, and the appointment slot engine reads `branches.hours`.

### E.2 Sprint N+2 — Payments live + storefront correctness

1. **M-Pesa + Pesapal end-to-end against real credentials.** Both are now unblocked and both sit at "⏭ UPCOMING" on the client's own tracker — the most visible progress available.
2. **Waves 3 + 4** — web writes, cart, and account reads onto the API.
3. **Remove COD** from checkout (client is not offering it).
4. **Hide the promotions UI** (client has no promo structure).
5. **Delete the duplicate contact route** (`web/app/api/contact/route.ts` vs Nest `POST /api/contact`).
6. **Policy pages** reflecting the real answers: no refunds, pickup + Wells Fargo, warranty.

### E.3 Sprint N+3 — SEO, catalogue, delivery model

1. **G-5 + G-7**, then **Wave 5** — Server Components + `generateMetadata` + server-side JSON-LD (closes TD-3 and TD-4).
2. **Wells Fargo pickup-station checkout** (C-3) — needs the station list.
3. **Catalogue ingestion** — the moment Section 1 arrives. Build the importer *now* against the sheet's column shape (`Product Name / SKU / Category / Brand / Frame Shape / Material / Gender / Colour / MRP / Selling / Cost / Tax %`) so ingestion is same-day.
4. **Wave 6** — `no-restricted-imports` on `@optex/db`, `typecheck` on `apps/web`. Lock the door.

### E.4 Not yet scheduled — and why

| Item | Blocked on |
| --- | --- |
| Lens configurator + coating add-ons | Full price matrix (client gave "from $28 / from $20" only) |
| eTIMS integration (C-2) | Scoping + commercial agreement — this is CR-02 |
| Appointment slot configuration | Section 4 — entirely blank |
| **All of CR-01** | Section 5 — entirely blank, including the delivery-model decision |
| Google Maps on branch locator | API key from client |
| Flutter app / Play Store | Play Console account ($25, client action) |
| Virtual Try-On | Phase 3 by contract |

---

## Part F — What I need decided

**From you:**

1. Confirm Wave order, or tell me to start Wave 1 immediately (it needs no client input and fixes a live bug).
2. Wave 5 = TypeScript conversion. Agree, or keep `apps/web` in JS?
3. Is "client managed" hosting settled, or is Vercel + Supabase still winnable? It changes the deploy work substantially.

**From the client (send as one list — this is the critical path):**

1. **Currency — KES or USD?** (C-1, blocks all commercial logic)
2. **Section 1 — the product catalogue.** Nothing ships without it.
3. **Section 5 — CR-01 decisions**, starting with Phase 1A+1B split vs combined.
4. **Section 4 — appointment slot rules.**
5. **eTIMS** — confirm it's required, and accept it's a separate change request. (C-2)
6. **Wells Fargo station list** + which are in the free-delivery zone. (C-3)
7. Confirm `Business model.xlsx` supersedes Section 2 of `filled.xlsx`. (C-4)
8. Google Maps API key; Play Console; Paul's email address.

---

*Evidence for every claim in Part B is a file:line reference. Where I could not verify something this pass, I have said so rather than guessed.*
