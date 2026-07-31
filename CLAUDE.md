# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last refreshed:** 2026-07-22, against actual code state + the Notion planning hub (see [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md) for the detailed feature-by-feature audit this refresh was based on).

## Repository layout

OPTEX is an eyewear retail platform for **Optex Opticians (Kenya)**. The binding contract is **OPTEX-SOW-2025-001-KE v3.0** (8-week Kenya build + a later Phase 3 Virtual Try-On) — see [docs/AUDIT.md](docs/AUDIT.md) and [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md). The India v1 SOW is **superseded** (different payment stack — Razorpay/UPI vs M-Pesa/Pesapal/COD). The legacy `Frontend/` CRA+Vite mockup trees (visual reference only) have been **deleted from this repo** — they were a separate git repo, fully preserved on GitHub at `kalyan1421/Optex-frontend`, not referenced by any code here.

Repo siblings at the root:

- `apps/web/` — Next.js 14 customer storefront. Home, shop, PDP with JSON-LD, cart, checkout, order tracking, appointments, search, branch locator, login/signup. Server Components read Supabase **directly** for SSR/SEO pages; all writes go through `apps/api`.
- `apps/admin/` — Next.js 14 super-admin panel. `(authed)` route group gated by `middleware.ts` requiring `app_metadata.role === 'super_admin'` (note: `app_metadata`, not `user_metadata` — the latter is user-writable and must never be trusted for authorization; see the Auth section below for a known gap where this rule isn't yet applied consistently). **All 12 admin pages are real, DB-backed implementations** — dashboard, products, orders, customers, appointments, inventory, reviews, promotions, branches, analytics, payments, prescriptions. Only two small gaps remain: `Customers.tsx`'s "Deactivate" action is disabled ("coming soon"), and `Analytics.tsx` has one hardcoded `categoryPerformance` chart series pending its own query.
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

Schema, RLS, and Storage buckets live in `Backend/supabase/migrations/` (`0001_init_schema.sql` → `0008_api_hardening.sql`) with dev seed in `Backend/supabase/seed.sql`. Notable later migrations: `0006_security_fixes.sql` (RLS lockdown on `orders` INSERT, `current_customer_id()` SECURITY DEFINER, `order_number` default, NOT NULL customer_id columns), `0007_security_meta.sql` (redefines `is_super_admin()` to check **`app_metadata.role`** only — the original `0001` version incorrectly checked `user_metadata.role`), `0008_api_hardening.sql` (atomic `place_order` RPC, promo-code column, `increment_promo_uses`, appointment reminder flags).

Auth model: Supabase Auth for customers; Super Admin is a Supabase user with `app_metadata.role = 'super_admin'` (server-set only, via the admin API — **not** `user_metadata`, which any authenticated user can rewrite via the client SDK). All three authorization checks in the codebase — `is_super_admin()` (SQL, RLS), `apps/admin/middleware.ts`, and `apps/api/src/supabase/supabase.service.ts`'s `verifyAccessToken()` — correctly check `app_metadata.role` only, with no `user_metadata` fallback anywhere. (This was fixed 2026-07-22 after a self-escalation path was found and verified: a signed-up customer could call `auth.updateUser({ data: { role: 'super_admin' } })` and have the NestJS `RolesGuard` trust the resulting `user_metadata.role`. Confirmed closed — a live exploit attempt against `/api/admin/dashboard` now correctly returns 403.)

Payment webhooks (M-Pesa Daraja, Pesapal IPN) use the service-role key to bypass RLS and write to `mpesa_transactions` / `pesapal_transactions`. Prescription files are namespaced by customer id under the private `prescriptions` bucket; downloads are ownership-checked server-side (`prescriptions.service.ts`) before issuing a 60s signed URL.

## Cross-cutting

- No CI is wired up (no `.github/workflows/`). `apps/api/test/app.e2e-spec.ts` is the only automated test in the repo (health/products/categories/branches smoke checks) — web and admin have zero tests. Treat this as the top risk area when making changes; verify manually via the running dev servers.
- `pnpm -r lint` is currently broken: `apps/web`/`apps/admin` call `next lint` but no ESLint config or dependency exists anywhere in the repo. `apps/api`'s `"lint"` script is just an alias for `tsc --noEmit` (there's no real linter in the monorepo yet).
- `pnpm -r typecheck` passes clean across all packages that define it. `apps/web` doesn't currently have a `typecheck` script (its siblings do).
- CR-01 (RBAC with 7 roles, full inventory ledger, doctor consultation module, product analytics, branch P&L) is **Phase 1B, not started** — see `docs/MISSING_FEATURES.md` for the full breakdown. It's sequenced to build on top of Phase 1A, which is itself already substantially complete (see that doc for exact status per feature).
