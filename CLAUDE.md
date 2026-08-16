# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last refreshed:** 2026-08-15, after the end-to-end audit and the remediation branch that followed it (findings F-01 … F-26). See [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md) for the feature-by-feature gap analysis and [docs/AUDIT.md](docs/AUDIT.md) for the tech-debt view.

## Repository layout

OPTEX is an eyewear retail platform for **Optex Opticians (Kenya)**. The binding contract is **OPTEX-SOW-2025-001-KE v3.0** (8-week Kenya build + a later Phase 3 Virtual Try-On) — see [docs/AUDIT.md](docs/AUDIT.md) and [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md). The India v1 SOW is **superseded** (different payment stack — Razorpay/UPI vs M-Pesa/Pesapal/COD). The legacy `Frontend/` CRA+Vite mockup trees (visual reference only) have been **deleted from this repo** — they were a separate git repo, fully preserved on GitHub at `kalyan1421/Optex-frontend`, not referenced by any code here.

Repo siblings at the root:

- `apps/web/` — Next.js 14 customer storefront. Home, shop, PDP with JSON-LD, cart, checkout, order tracking, appointments, search, branch locator, login/signup. Server Components read Supabase **directly** for SSR/SEO pages; all writes go through `apps/api`. **Known gap:** the API's full prescription upload/list/download surface (`apps/api/src/modules/prescriptions/`) has no browser entry point anywhere in the storefront — no upload form on the profile page, in checkout, or elsewhere — and the admin panel's `Prescriptions.tsx` can only review what a customer has already uploaded, not upload on their behalf. The backend is thoroughly tested (`apps/api/test/prescriptions.e2e-spec.ts`); there is simply no UI that calls it. Found while closing audit F-17 (missing e2e coverage) — this is a missing feature, not a missing test, so it was flagged rather than built.
- `apps/admin/` — Next.js 14 super-admin panel. `(authed)` route group gated by `middleware.ts` requiring `app_metadata.role === 'super_admin'` (note: `app_metadata`, not `user_metadata` — the latter is user-writable and must never be trusted for authorization; see the Auth section below for a known gap where this rule isn't yet applied consistently). **All 12 admin pages are real, DB-backed implementations** — dashboard, products, orders, customers, appointments, inventory, reviews, promotions, branches, analytics, payments, prescriptions. Both of the small gaps previously listed here (the disabled "Deactivate" action and a hardcoded `categoryPerformance` series) were closed in `7200a6f`.
- `apps/api/` — NestJS backend (Node/Express under the hood). Owns all writes, payments, webhooks, comms, admin mutations, and cron jobs; will also serve the future Flutter app. Uses the Supabase **service-role client** (bypasses RLS; RLS stays as defense-in-depth). 13 feature modules: auth, catalog, cart, orders/checkout, payments (M-Pesa Daraja + Pesapal), notifications (Africa's Talking SMS + Resend email), appointments, prescriptions, reviews, promotions, branches, admin-metrics, cron. `pnpm -r typecheck` passes clean; no TODO/stub markers found in `src/`.
- `packages/ui/` — shadcn primitives (Button, Card, Input, Label, Badge, Separator) + `cn` + `formatKes` (NaN/null-safe), shared by web and admin.
- `packages/db/` — Hand-derived Supabase types, browser/server/service client factories, query helpers for the Next.js-direct-read paths. **Service client throws if imported on the client.**
- `packages/api-client/` — Typed client for `apps/web`/`apps/admin` to call `apps/api`.
- `packages/validators/` — Shared zod (or similar) validation schemas.
- `packages/config/` — Tailwind preset with brand tokens (`brand.blue #2A3182`, `brand.red #E53935`, `brand.dark #1A1A2E`) + Montserrat font + CSS-variable theme tokens.
- `Backend/supabase/` — Schema, RLS, storage migrations (`0001` through `0008`), seed. See [Backend/README.md](Backend/README.md).
- `docker-compose.yml` + `docker/` — Full local dev stack (Supabase Postgres/Auth/REST/Storage/Kong + the API), see "Local dev" below.
- `docs/AUDIT.md` — Consolidated tech-debt audit, Figma-to-code comparison, 8-week ship plan.
- `docs/MISSING_FEATURES.md` — Feature-by-feature gap analysis against the SOW + CR-01, refreshed 2026-07-22.

Pnpm workspace: `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. Bootstrap with `pnpm install` from the repo root.

## Local dev

Dev server ports (set in each app's `package.json` and mirrored in `.claude/launch.json`):

- `pnpm dev:api` → **`http://localhost:1111`** (NestJS, routes under `/api`, Swagger at `/api/docs`)
- `pnpm dev:web` → **`http://localhost:1112`**
- `pnpm dev:admin` → **`http://localhost:1113`**

(These were moved off 3000/3001/4000 to avoid collisions with other local processes — if you see those ports referenced in older docs/scripts, they're stale.)

Local Supabase stack: `docker compose up -d supabase-kong` brings up Postgres + Auth + REST + Storage + Kong (gateway at `:54321`, Postgres at `:54322`). `docker/migrate.sh` idempotently applies `Backend/supabase/migrations/*.sql` + `seed.sql` on every `supabase-migrate` run. Each app's `.env.example` ships working local-dev defaults (Kong URL, anon/service-role JWTs signed with the shared local JWT secret) — copy to `.env`/`.env.local` to run against the Docker stack.

## Backend (Supabase)

Schema, RLS, and Storage buckets live in `Backend/supabase/migrations/` (`0001_init_schema.sql` → `0024_review_trust_and_ratings.sql`) with dev seed in `Backend/supabase/seed.sql`. Notable later migrations: `0006_security_fixes.sql` (RLS lockdown on `orders` INSERT, `current_customer_id()` SECURITY DEFINER, `order_number` default, NOT NULL customer_id columns), `0007_security_meta.sql` (redefines `is_super_admin()` to check **`app_metadata.role`** only — the original `0001` version incorrectly checked `user_metadata.role`), `0008_api_hardening.sql` (atomic `place_order` RPC, promo-code column, `increment_promo_uses`, appointment reminder flags).

Migrations from the audit remediation (2026-08-15):

- `0020_checkout_stock_enforcement.sql` — **F-02**. `place_order` now locks the cart's `inventory` rows, rejects the checkout if any line exceeds available stock, and deducts across active branches, all inside the existing transaction. Before this, checkout never consulted inventory at all and every product was infinitely purchasable. Availability is the sum across branches because orders carry no fulfilment branch; a trigger gives new products zero-stock rows so they are visible in the admin grid rather than silently unsellable.
- `0021_cron_advisory_lock.sql` — **F-05**. `try_claim_cron_run` gives the scheduled jobs leader election with a lease, so the API can run more than one replica. Deliberately a transaction-scoped advisory lock over a lease row, not a session lock: session locks are unsafe over PostgREST's connection pool.
- `0022_reminder_flag_claim.sql` — **F-04**. `claim_due_reminders` selects, flags and returns due appointments in one statement, making reminder SMS exactly-once. The `reminder_24h_sent` / `reminder_1h_sent` columns 0008 added had never been wired up.
- `0023_notification_log.sql` — **F-06**. Durable record of every SMS/email attempt, with backoff and a retry sweep. Failures used to be logged to stdout and dropped.
- `0024_review_trust_and_ratings.sql` — **F-11, F-12**. `verified_purchase` on reviews (set once by trigger), plus trigger-maintained `rating_avg` / `rating_count` on `products` so listings can show stars without a per-product round trip.

Auth model: Supabase Auth for customers; Super Admin is a Supabase user with `app_metadata.role = 'super_admin'` (server-set only, via the admin API — **not** `user_metadata`, which any authenticated user can rewrite via the client SDK). All three authorization checks in the codebase — `is_super_admin()` (SQL, RLS), `apps/admin/middleware.ts`, and `apps/api/src/supabase/supabase.service.ts`'s `verifyAccessToken()` — correctly check `app_metadata.role` only, with no `user_metadata` fallback anywhere. (This was fixed 2026-07-22 after a self-escalation path was found and verified: a signed-up customer could call `auth.updateUser({ data: { role: 'super_admin' } })` and have the NestJS `RolesGuard` trust the resulting `user_metadata.role`. Confirmed closed — a live exploit attempt against `/api/admin/dashboard` now correctly returns 403.)

Payment webhooks (M-Pesa Daraja, Pesapal IPN) use the service-role key to bypass RLS and write to `mpesa_transactions` / `pesapal_transactions`. Prescription files are namespaced by customer id under the private `prescriptions` bucket; downloads are ownership-checked server-side (`prescriptions.service.ts`) before issuing a 60s signed URL.

## Cross-cutting

- **CI** is wired up in `.github/workflows/ci.yml` — three jobs: `static` (typecheck, lint, build, Prettier check), `e2e` (API suite against a real Supabase stack) and `smoke` (storefront Playwright against a production build).
- **Tests**: 157 API e2e tests across 15 suites (`apps/api/test/`), 25 storefront tests across 9 Playwright spec files (`apps/web/e2e/` — audit F-17 closed the appointment-booking, wishlist, and promo-redemption gaps; prescription upload/download has no browser entry point to test at all, see below) and 5 admin Playwright specs, plus 28 unit tests (`apps/api/test/unit/`, `packages/ui/src/lib/format.spec.ts` — audit F-08) covering the pure logic the e2e suite used to be the only way to reach. There are still **no contract tests** for `packages/api-client`, the typed boundary three apps depend on.
- **Load tests** live in `load/` (k6, audit F-07) and are not part of CI — they need a running stack. `load/README.md` explains why they target the storefront on :1112 rather than the API directly.
- `pnpm -r lint` works and is enforced in CI (ESLint + `jsx-a11y`; configs in `apps/web/.eslintrc.js` and `apps/admin/.eslintrc.js`).
- `pnpm -r typecheck` passes clean across all nine workspace projects, `apps/web` included.
- CR-01 (RBAC with 7 roles, full inventory ledger, doctor consultation module, product analytics, branch P&L) is **Phase 1B, not started** — see `docs/MISSING_FEATURES.md` for the full breakdown. It's sequenced to build on top of Phase 1A, which is itself already substantially complete (see that doc for exact status per feature).
