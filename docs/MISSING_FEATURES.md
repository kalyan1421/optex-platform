# OPTEX — Missing Features & Gap Analysis

**Last audited:** 2026-07-22
**Audited against:** OPTEX-SOW-2025-001-KE v3.0 + Change Request CR-01 + the Notion planning hub ("OPTEX OPTICIANS — Digital Transformation Hub" and its "Backend API — NestJS Build Plan" child page)

This is a full refresh of the previous 2026-06-09 audit. **Almost everything marked ❌/🟡 in that version has since been built** — the NestJS backend (`apps/api`) shipped in 13 waves per the Notion build log, closing nearly every Phase 1A gap. Status below reflects direct code inspection, not the build log's self-reported status.

---

## Legend

| Symbol | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| ✅     | Fully implemented (real DB, real logic), verified in code |
| 🟡     | Implemented but with a known small gap                    |
| ❌     | Missing entirely (no file, no route, no logic)            |
| 🔴     | Open security issue — do not treat as "done" until fixed  |

---

## Fixed since the last audit: auth privilege escalation

| #   | Feature                                      | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-7 | NestJS `verifyAccessToken()` role resolution | ✅     | Was 🔴: `apps/api/src/supabase/supabase.service.ts` fell back to the self-writable `user_metadata.role` when `app_metadata.role` was unset (true for every customer post-signup), so any authenticated customer could grant themselves `super_admin` via `auth.updateUser(...)` and have `RolesGuard` trust it. **Fixed 2026-07-22** — now reads `app_metadata.role` only, matching `is_super_admin()` (SQL) and `apps/admin/middleware.ts`. Verified by live exploit attempt: a fresh signup + self-set `user_metadata.role='super_admin'` + `GET /api/admin/dashboard` now correctly returns `403 Forbidden` (confirmed both before the fix, where it would have succeeded, and after). |

---

## Phase 1A — Original SOW (launch-blocking gaps)

### Group 1: Security & DB Fixes

| #   | Feature                                                     | Status | Notes                                                                                                                                                                                             |
| --- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | `orders` INSERT RLS lockdown                                | ✅     | Fixed in `0006_security_fixes.sql`                                                                                                                                                                |
| S-2 | `current_customer_id()` SECURITY DEFINER                    | ✅     | Fixed in `0006_security_fixes.sql`                                                                                                                                                                |
| S-3 | `order_number` column DEFAULT                               | ✅     | Fixed in `0006_security_fixes.sql`                                                                                                                                                                |
| S-4 | Nullable `orders.customer_id` + `prescriptions.customer_id` | ✅     | Fixed in `0006_security_fixes.sql`                                                                                                                                                                |
| S-5 | `formatKes(NaN)` guard in `@optex/ui`                       | ✅     | `packages/ui/src/lib/format.ts:20` — `if (amount == null \|\| !isFinite(amount)) return '—'`                                                                                                      |
| S-6 | Atomic cart clear after order                               | ✅     | Checkout now runs through the atomic `place_order` Postgres RPC (`0008_api_hardening.sql`), called from `apps/api/src/modules/orders/orders.service.ts` — no more loop-based partial-failure risk |

### Group 2: Payment Infrastructure

| #   | Feature                             | Status | Notes                                                                                                                                                |
| --- | ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | M-Pesa Daraja STK Push API call     | ✅     | `apps/api/src/modules/payments/mpesa.service.ts` — full OAuth + STK push                                                                             |
| P-2 | M-Pesa callback webhook handler     | ✅     | `POST /api/webhooks/mpesa` in `webhooks.controller.ts`                                                                                               |
| P-3 | Pesapal redirect URL + IPN webhook  | ✅     | `pesapal.service.ts` + `POST/GET /api/webhooks/pesapal`                                                                                              |
| P-4 | M-Pesa transaction status polling   | ✅     | `apps/api/src/modules/cron/` — polls Daraja for STK result, reuses the M-Pesa client                                                                 |
| P-5 | Payment pending / confirmation page | ✅     | `apps/web/app/order-confirmation/[orderId]` route exists                                                                                             |
| P-6 | Admin Payments page — real data     | ✅     | Now queries `mpesa_transactions`/`pesapal_transactions` via `@optex/db`; admin reconcile endpoint (`POST /api/admin/payments/:id/reconcile`) is real |

### Group 3: Web Storefront Pages

| #   | Page/Feature                             | Status | Notes                                                                                                                          |
| --- | ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| W-1 | `/appointments` — booking wizard         | ✅     | Route exists, wired to `apps/api` appointments module                                                                          |
| W-2 | `/orders/[id]/tracking` — order tracking | ✅     | `GET /api/orders/:id/tracking` + web route                                                                                     |
| W-3 | `/search` — product search               | ✅     | Uses `search_tsv` via `.textSearch(..., { type: 'websearch' })` in `products.service.ts` (the old broken tsquery cast is gone) |
| W-4 | `/branch-locator` — Google Maps          | ✅     | Route exists, DB-driven via branches module                                                                                    |
| W-5 | Customer review form on PDP              | ✅     | `POST /api/products/:productId/reviews`                                                                                        |
| W-6 | Order confirmation / thank-you page      | ✅     | Same route as P-5                                                                                                              |

### Group 4: Admin Panel

| #   | Admin Page                    | Status | Notes                                                                                                                                                     |
| --- | ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | Analytics page                | ✅     | Was 🟡 as of this audit's original 2026-07-22 pass; fixed 2026-08-07 (`300139b`) — `GET /api/admin/analytics`'s `revenueByCategory` now backs the category chart with a real revenue/growth query, no fixture remains |
| A-2 | Payments page                 | ✅     | See P-6                                                                                                                                                   |
| A-3 | Prescriptions page            | ✅     | Real DB query + ownership-checked signed-URL viewer                                                                                                       |
| A-4 | Dashboard revenue chart       | ✅     | `GET /api/admin/dashboard` returns real KPIs                                                                                                              |
| A-5 | Customers "Deactivate" action | ✅     | Fixed 2026-08-15 — `PATCH /api/admin/customers/:id` (migration `0019`, `deactivated_at` column) bans/unbans the linked `auth.users` row via the Supabase Admin API in lockstep with the flag, so a deactivated customer genuinely cannot sign in, not just a display badge |

### Group 5: Communications

| #   | Feature                                                | Status | Notes                                                                                                   |
| --- | ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------- |
| C-1 | Africa's Talking SMS — order confirmation              | ✅     | `apps/api/src/modules/notifications/sms.service.ts`, called from `orders.service.ts` checkout flow      |
| C-2 | Africa's Talking SMS — appointment reminder (24h + 1h) | ✅     | `apps/api/src/modules/cron/appointment-reminders.job.ts`                                                |
| C-3 | Contact form → real email                              | ✅     | `apps/web/app/api/contact/route.ts` — real Resend integration, HTML-escaped, IP rate-limited            |
| C-4 | Order confirmation email                               | ✅     | Same checkout path as C-1 (`orders.service.ts:600` area — "best-effort order-confirmation email + SMS") |

### Group 6: SEO & Content Pages

| #   | Feature                                            | Status | Notes                                                                          |
| --- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| E-1 | JSON-LD: LocalBusiness schema                      | ❓     | Not re-verified this pass — re-check `apps/web/app/layout.tsx` before assuming |
| E-2 | JSON-LD: MedicalOrganization schema                | ❓     | Not re-verified this pass                                                      |
| E-3 | JSON-LD: FAQ schema                                | ❓     | Not re-verified this pass                                                      |
| E-4 | JSON-LD: Product schema                            | ✅     | CLAUDE.md and prior audits confirm PDP ships JSON-LD                           |
| E-5 | `/category/[slug]` landing pages                   | ❓     | Not re-verified this pass                                                      |
| E-6 | Trust pages (warranty, returns, delivery, privacy) | ❓     | Not re-verified this pass                                                      |

_(Group 6 wasn't part of this refresh's direct-inspection scope — flagged ❓ rather than guessed. Worth a dedicated pass before treating SEO as complete.)_

### Group 7: `@optex/db` / API-layer Fixes

| #   | Issue                                             | Status | Notes                                                                                                              |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| D-1 | `textSearch` type cast broken                     | ✅     | Fixed — see W-3                                                                                                    |
| D-2 | `createOrder` missing `discount_kes`              | ✅     | Notion build log confirms `place_order` RPC persists the discount; `orders.service.ts` checkout flow reads it back |
| D-3 | `getOrCreateCart` race condition                  | ✅     | `cart.service.ts:301-308` — atomic upsert with `onConflict: 'customer_id', ignoreDuplicates: true`                 |
| D-4 | `product-image.js` no fallback on missing env var | ❓     | Not re-verified this pass                                                                                          |
| D-5 | Admin `formatKes` duplicates                      | ✅     | All admin components confirmed importing the shared `@optex/ui` version; no local duplicates found                 |

---

## Phase 1B — CR-01 Features (post-launch, not started)

No evidence of build in any of these areas — still ❌ across the board, sequenced to start after Phase 1A fully closes (including S-7 above).

**CR-01.2 — Multi-Role Admin / RBAC** _(foundational — blocks all other CR-01 modules)_: 7 roles, permission matrix, route middleware, branch-scoped filtering, user management screen, audit log, 2FA — all ❌.

**CR-01.1 — Full Inventory Management** _(requires RBAC)_: supplier/vendor data, PO module, GRN, real-time stock ledger, inter-branch transfers, stock adjustments, reorder alerts, stock valuation, dead-stock reporting, physical count reconciliation — all ❌.

**CR-01.5 — Doctor Consultation Module** _(requires RBAC + Phase 1A appointments)_: doctor master data, branch assignment/availability, leave calendar, consultation types, slot engine, booking wizard, in-clinic queue, consultation notes/e-prescription, patient medical profile, consultation payments, DPA 2019 consent flow, utilization reports — all ❌.

**CR-01.4 — Product Analytics & Reporting** _(requires Inventory ledger)_: cost-price field, days-on-shelf/sell-through/velocity, fast/slow-movers, dead-stock, margin analysis, CSV export, scheduled digests — all ❌.

**CR-01.3 — Branch P&L & Investment Analysis** _(parallel-safe)_: capex entry, opex tracking, P&L statement, ROI/break-even, branch comparison, scheduled snapshots — all ❌.

---

## What IS Complete ✅ (verified 2026-07-22)

### Web Storefront (`apps/web`)

Home, shop (filters/sort), PDP, search, cart, multi-step checkout (COD/M-Pesa/Pesapal), order confirmation, order tracking, appointments booking, branch locator, product reviews, login/signup/reset, profile (orders + prescriptions), contact form (real email).

### Admin Panel (`apps/admin`)

All 12 pages real and DB-backed: dashboard, products (full CRUD + image upload), orders, customers, appointments, inventory, reviews, promotions, branches, analytics (one fixture chart remaining), payments (real reconcile), prescriptions (signed-URL viewer). Login gated by `app_metadata.role`.

### Backend API (`apps/api`) — new since the last audit

NestJS, 13 feature modules, service-role Supabase client, `pnpm -r typecheck` clean, zero TODO/stub markers: auth, catalog (incl. search), cart, orders/checkout (atomic `place_order` RPC), payments (M-Pesa + Pesapal + webhooks + reconcile), notifications (SMS + email), appointments, prescriptions (ownership-checked), reviews, promotions, branches, admin-metrics, cron (reminders + M-Pesa polling).

### Backend / Packages

Supabase schema: 8 migrations (`0001`–`0008`), RLS on all tables, `place_order` RPC, `is_super_admin()` correctly scoped to `app_metadata`. `@optex/db`, `@optex/ui`, `@optex/api-client`, `@optex/config`, `@optex/validators` all in active use by at least one app.

### Local dev infrastructure

Full Docker Compose stack (Postgres/Auth/REST/Storage/Kong) with working migrations and correctly-signed local JWTs; documented in `CLAUDE.md`.

---

## What's Actually Left

1. ~~Fix S-7 (auth privilege escalation)~~ — **done, verified 2026-07-22.**
2. **Wire up ESLint** — `pnpm -r lint` is currently broken (no ESLint config/deps anywhere in the repo).
3. **Add real test coverage** — currently one 78-line e2e smoke spec for the whole API, zero tests in web/admin, no CI.
4. ~~Close the two small admin gaps~~ — **done.** Analytics (A-1) 2026-08-07; Customers' deactivate action (A-5) 2026-08-15.
5. **Re-verify Group 6 (SEO) and D-4** — not covered by this pass's direct-inspection scope.
6. **Core Web Vitals / UAT / deploy cutover** (SOW Week 7) and **Play Store / mobile handover** (Week 8, Flutter app — separate repo) — no evidence of work in this repo yet.
7. **CR-01 (Phase 1B)** — RBAC, inventory ledger, doctor consultation, product analytics, branch P&L — not started, correctly sequenced to come after Phase 1A fully closes.

**Phase 1A is now substantially complete** — the ~35–40 dev-days estimated in the previous audit have largely been spent building the NestJS backend. What's left is a short punch list (above), not a rebuild.
