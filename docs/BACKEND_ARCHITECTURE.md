# OPTEX — Backend Architecture & Gap Analysis

**Scope:** Full backend for both applications — `apps/web` (storefront) and
`apps/admin` (super-admin panel) — covering the NestJS API, the Supabase data
layer, payments, notifications, scheduling, Docker/infrastructure, and a
consolidated register of gaps and issues with fixes.

**Contract:** OPTEX-SOW-2025-001-KE v3.0 (Optex Opticians, Kenya).
**Date:** 2026-06-26 · **Status:** design + hardening pass.

> **Decisions taken for this design** (from the project owner):
>
> - **Target architecture: the NestJS API is the system of record** — all data
>   access from both apps routes through it (today the apps bypass it; see §2).
> - **Hosting: not yet decided — recommendation in §6** (Fly.io / Render, single
>   container, colocated with Supabase).
> - **Scale: low-traffic, single instance** — one optician, a few branches.
>   In-process throttling and cron are acceptable now; the horizontal-scale path
>   (Redis) is documented as a later upgrade, not built yet.

---

## 1. Executive summary

The backend is far more complete than a typical mid-build: a 14-module NestJS API
(`apps/api`), a hardened Supabase schema (migrations `0001`–`0008` with three
dedicated security passes), typed shared packages (`@optex/db`,
`@optex/api-client`, `@optex/validators`), payment rails (M-Pesa Daraja + Pesapal

- COD), SMS/email, and cron reconciliation.

The **single most important finding** is architectural, not a bug:

> **The web and admin apps never call the NestJS API.** Both query Supabase
> directly through `@optex/db`. The entire `apps/api` + `@optex/api-client` is
> built, typed, and ~0% consumed. As a result, the **payment flow is
> disconnected** — checkout writes an order straight to the DB and never
> initiates M-Pesa/Pesapal, and the admin Payments/Analytics/Prescriptions
> screens render hardcoded fixtures.

Given the decision to make the **API the system of record**, the headline work is
to route both apps through the API and retire direct-Supabase writes. The schema
and API are largely ready for that; the gap is wiring, not foundations.

A secondary theme: **migration 0008 shipped atomic RPCs (`place_order`,
`increment_promo_uses`) that the application never adopted.** This pass wires
checkout to `place_order` (see §9), closing the atomicity and promo-race gaps in
one move.

---

## 2. Current architecture (as-is)

```
                        ┌──────────────────────────────────────────┐
                        │              Supabase (cloud)             │
                        │  Postgres + RLS · Auth · Storage buckets  │
                        └───────▲───────────────▲──────────────▲────┘
        anon / user JWT         │               │ service-role │
       (RLS-enforced)          │               │ (RLS bypass) │
            ┌──────────────────┘               │              │
            │                                   │              │
   ┌────────┴────────┐   ┌───────────────┐  ┌──┴───────────────┴───┐
   │   apps/web      │   │  apps/admin   │  │     apps/api (Nest)   │
   │  Next.js 14     │   │  Next.js 14   │  │  14 modules, guards,  │
   │                 │   │               │  │  payments, cron, SMS  │
   │  @optex/db ─────┼───┼──── @optex/db │  │                       │
   │  (direct reads  │   │  (direct r/w) │  │  @optex/api-client    │
   │   + WRITES)     │   │               │  │  ◄── defined, UNUSED  │
   └─────────────────┘   └───────────────┘  └───────────▲───────────┘
                                                         │
                          M-Pesa Daraja / Pesapal  ──────┘  (webhooks land here,
                          but checkout never triggers them)
```

**What this means in practice**

| Concern                                                | Today                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Reads (catalog, branches, dashboard)                   | Direct Supabase via `@optex/db`, protected by RLS. Works.                                               |
| Cart / checkout                                        | `apps/web` calls `@optex/db.createOrder()` directly — order is written but **no payment is initiated**. |
| Payments                                               | API has full M-Pesa/Pesapal logic + webhooks; **no app ever calls the initiate endpoints**.             |
| Admin Payments / Analytics / Prescriptions             | **Hardcoded fixtures**, no DB calls.                                                                    |
| SMS / email confirmations                              | Implemented in the API; **never fire** because checkout doesn't go through the API.                     |
| Business rules (VAT, promo, stock, status transitions) | Live in the API service layer **and** partially duplicated in `@optex/db` — two sources of truth.       |

This is the core risk: business logic, payment orchestration, and notifications
all live behind an API that nothing calls.

---

## 3. Target architecture (API = system of record)

Every mutation and sensitive read flows through the NestJS API. Direct-Supabase
access from the apps is retired except for **Supabase Auth** (login/signup/session
refresh stays client-side — it's the identity provider) and **Storage reads via
signed URLs minted by the API**.

```
   ┌─────────────┐        HTTPS (Bearer JWT)        ┌────────────────────────┐
   │  apps/web   │ ───────────────────────────────► │      apps/api (Nest)   │
   │ Next.js 14  │      via @optex/api-client        │                        │
   └─────┬───────┘                                   │  Guards: throttle →    │
         │ Supabase Auth only (login/session)        │  authn (JWT) → authz   │
         ▼                                           │  (roles)               │
   ┌─────────────┐                                   │                        │
   │  Supabase   │ ◄──── service-role (RLS bypass) ──│  Service layer owns:   │
   │  Auth       │                                   │  • checkout (place_order RPC)
   └─────────────┘                                   │  • payments + webhooks  │
                                                     │  • notifications        │
   ┌─────────────┐        HTTPS (Bearer JWT)         │  • admin ops            │
   │ apps/admin  │ ───────────────────────────────► │  • cron reconcile       │
   │ Next.js 14  │   admin endpoints (role-gated)    └───────────┬────────────┘
   └─────────────┘                                               │ service-role
                                                                 ▼
                                                       ┌────────────────────┐
                          M-Pesa Daraja ──► /api/webhooks/mpesa  │  Postgres + RLS    │
                          Pesapal IPN   ──► /api/webhooks/pesapal │  (RLS = defense    │
                                                       └──────────┤   in depth)        │
                                                                  └────────────────────┘
```

### Request lifecycle (authenticated)

1. App attaches `Authorization: Bearer <supabase-access-token>`.
2. `ThrottlerGuard` (100 req/min/IP) → `SupabaseAuthGuard` (verifies JWT) →
   `RolesGuard` (`@Roles('super_admin')` where required).
3. Controller validates the DTO (`class-validator`, `whitelist: true`).
4. Service resolves `customers.id` from the JWT's `auth_user_id` and scopes every
   query to it (ownership enforced in code, since the service-role client bypasses
   RLS).
5. `AllExceptionsFilter` returns a consistent error envelope with a `requestId`;
   internal errors are logged, never echoed (hardened this pass — §9).

### Auth & authorization model

| Principal        | Identity                                                                                                         | Authorization                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Customer         | Supabase Auth user; `customers` row auto-created by trigger `0004`.                                              | Owns only their rows. API scopes by `customers.id`; RLS enforces the same on any direct path.                                             |
| Super admin      | Single Supabase user, `app_metadata.role = 'super_admin'` (server-set, **not** user-writable — fixed in `0007`). | `RolesGuard` + `is_super_admin()` SQL helper.                                                                                             |
| Provider webhook | No JWT (`@Public()` + `@SkipThrottle()`).                                                                        | Trust derives from amount verification + status re-query + (recommended) IP allow-list — **not** a signature (Daraja/Pesapal don't sign). |

### Two clients, two trust levels (keep this invariant)

- **Browser/server Supabase client** (`@optex/db` anon/user) → **RLS-enforced**.
  After the migration, used only for Auth and signed-URL reads.
- **Service-role client** (`apps/api`) → **RLS-bypassing**. Privileged; never
  reaches the browser (`@optex/db/service.ts` throws if imported client-side).

---

## 4. Component breakdown

### NestJS API modules (`apps/api/src/modules`)

| Module          | Customer surface                                   | Admin surface         | Notes                                                                                              |
| --------------- | -------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `catalog`       | products, search (FTS), categories                 | product CRUD          | `search_tsv` GIN index backs search.                                                               |
| `cart`          | get/add/update/remove, apply-promo                 | —                     | Atomic qty via `increment_cart_item_qty` (0007). Promo now persisted on `carts.promo_code` (0008). |
| `orders`        | checkout, history, detail, tracking                | list, status workflow | **Checkout now uses `place_order` RPC** (§9). Status transitions validated.                        |
| `payments`      | M-Pesa STK push + query, Pesapal initiate + status | list, reconcile       | Webhooks at `/api/webhooks/{mpesa,pesapal}`. Idempotent; amount-verified (§9).                     |
| `appointments`  | slots, book, cancel, reschedule                    | manage                | Reminder idempotency flags (0008) — cron must use them.                                            |
| `prescriptions` | upload, list, signed download                      | manage                | Private `prescriptions` bucket, namespaced by customer id.                                         |
| `reviews`       | submit, list approved                              | moderate              | One review per (product, customer) enforced in DB.                                                 |
| `promotions`    | validate                                           | banner + code CRUD    | `increment_promo_uses` RPC (0008).                                                                 |
| `branches`      | list, detail                                       | CRUD                  | lat/lng for locator.                                                                               |
| `account`       | `GET/PATCH /me`                                    | —                     | Profile.                                                                                           |
| `admin-metrics` | —                                                  | dashboard, analytics  | Real queries exist; admin UI still on fixtures (gap).                                              |
| `notifications` | contact form                                       | —                     | `EmailService` (Resend), `SmsService` (Africa's Talking); both no-op safely without keys.          |
| `cron`          | —                                                  | —                     | `mpesa-polling` (reconcile pending), `appointment-reminders`. In-process (single instance).        |
| `health`        | `/api/health` liveness                             | —                     | Used by Docker/host probes.                                                                        |

### Shared packages

| Package                      | Role                                                   | Post-migration role                                 |
| ---------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `@optex/db`                  | Supabase clients + query helpers (hand-derived types). | Auth + signed-URL reads only; retire direct writes. |
| `@optex/api-client`          | Typed client for every API route (currently unused).   | **Becomes the primary data layer** for both apps.   |
| `@optex/validators`          | Shared zod schemas.                                    | Share DTO validation between apps and API.          |
| `@optex/ui`, `@optex/config` | shadcn primitives, Tailwind preset.                    | unchanged.                                          |

---

## 5. Data model & security posture

The schema is strong and has had three security passes. Highlights:

- **RLS on all 14 tables**, three tiers (anon / customer / super_admin). Customer
  isolation verified; no cross-customer leaks.
- **Privilege-escalation fixed** (`0007`): admin role moved from user-writable
  `user_metadata` to server-only `app_metadata`; `is_super_admin()` is
  `SECURITY DEFINER` with a locked `search_path`.
- **Payment idempotency**: `mpesa_transactions.mpesa_ref` and
  `pesapal_transactions.pesapal_order_id` are UNIQUE (replay-safe).
- **Atomic primitives** (`0007`/`0008`): `increment_cart_item_qty`,
  `increment_promo_uses`, `place_order` — all `SECURITY DEFINER`.
- **Order-fraud guard** (`0006`): INSERT RLS prevents a customer self-setting
  `status`/`payment_status`.

Open schema gaps (see register §8 for severity):

- No **RBAC/staff** model (optometrists, branch managers) — needed for CR-01 and
  to assign appointments. Today everyone non-admin is a "customer".
- No **inventory ledger** (stock movements / audit) — only a current-stock table.
- No **audit log** (who changed what) on admin mutations.
- Missing constraints: `customers.phone` not UNIQUE; no optical-value range checks
  on prescriptions; no DB-level money-math check on `orders`.
- A few missing indexes for admin reconciliation (`orders.payment_method`,
  `mpesa_transactions.received_at`).

---

## 6. Infrastructure & deployment

### Containerization (done this pass)

- **`apps/api/Dockerfile`** — multi-stage pnpm build, **now hardened**: runs as
  the non-root `node` user, `tini` as PID 1 for clean SIGTERM → graceful
  shutdown, and a `HEALTHCHECK` on `/api/health`.
- **`docker-compose.yml`** (root) — local stack: builds the API from the monorepo
  root context, `read_only` root FS, `no-new-privileges`, `init: true`,
  `host.docker.internal` mapping so the container can reach a local
  `supabase start`. Run `docker compose up --build api`.
- **`.env.example`** — completed to match every var `config/env.ts` reads
  (previously missing `PESAPAL_IPN_ID`, `PESAPAL_CALLBACK_URL`, `RESEND_FROM`,
  `CONTACT_INBOX`).

### Hosting recommendation

The API is a **long-lived, stateful-ish process** (in-process cron + webhook
endpoints that need a stable public HTTPS URL). That rules out
short-lived serverless functions as a clean fit. For a single Kenyan optician at
low traffic:

> **Recommended: a single always-on container on Fly.io or Render.**
>
> **Key insight — colocate the API with the Supabase region, not with users.**
> Every authenticated request currently makes a network round-trip to Supabase
> Auth (`auth.getUser`) _plus_ its data queries. DB round-trips dominate latency,
> so the API should sit in the **same region as the Supabase project**. Pick the
> Supabase region nearest Kenya (e.g. `eu-central-1` Frankfurt) and run the API
> in the matching provider region.
>
> - **Fly.io** — has a Johannesburg (`jnb`) region (closest to Kenya); good if
>   you also move Supabase/compute close to East Africa. Slightly more ops.
> - **Render** — simplest ops (push-to-deploy, managed TLS, secrets UI); no
>   African region, so colocate with the Supabase region (EU).
>
> Either gives: persistent process, managed HTTPS (needed for the webhook URLs),
> secret management, zero-downtime deploys, and the `/api/health` probe wired.

Whatever the host: set `CORS_ORIGINS` to the real web+admin domains, set
`MPESA_CALLBACK_URL` / `PESAPAL_IPN_URL` to the deployed `…/api/webhooks/*`
URLs, and register the Pesapal IPN to obtain `PESAPAL_IPN_ID`.

### Single-instance now → scale path later

Because we're designing for **one instance**, the in-process `ThrottlerModule`
and `@nestjs/schedule` cron are fine. **Before** running ≥2 replicas, add:

1. **Redis-backed throttler** (`@nestjs/throttler` + storage adapter) — in-memory
   counters don't share across replicas.
2. **Distributed cron lock** (Redis `SETNX` or Postgres advisory lock) — otherwise
   each replica runs `mpesa-polling` / reminders, duplicating work/SMS.
3. Confirm the API stays **stateless** (it is today, except the throttler).

### Performance quick win (recommended, not yet done)

`SupabaseAuthGuard` calls `supabase.auth.getUser(token)` on **every** authed
request — a network call to Supabase Auth per request. With
`SUPABASE_JWT_SECRET` (already an optional env var) the JWT can be verified
**locally** (signature + `exp`), removing that round-trip and decoupling API
availability from the Auth API. Recommended as the first latency optimization.

### Observability & ops

- **Logging**: `nestjs-pino` with request-id correlation and auth/cookie
  redaction — good. Ship stdout JSON to the host's log drain in prod.
- **Health**: `/api/health` exists; wire it to the host's liveness/readiness.
- **Errors**: consider Sentry (or similar) for the API.
- **CI/CD** (not present): add typecheck (`pnpm -r typecheck`) + `docker build`
  on PR; deploy on merge. Run `supabase db push` for migrations as a gated step.
- **Backups**: rely on Supabase PITR; verify the plan tier includes it before
  go-live.

---

## 7. Payment flows (reference)

**M-Pesa (Daraja STK push)** — customer pays online:

```
app → POST /api/payments/mpesa/stk-push {orderId, phone}
  api → resolve owned order, assert payable, read order.total_kes (server-side)
      → Daraja STKPush; persist mpesa_transactions(pending, ref=CheckoutRequestID)
Daraja → POST /api/webhooks/mpesa (callback)
  api → idempotency (skip if final) → VERIFY amount == tx.amount_kes → credit order
        (payment_status=paid, status=processing) → SMS+email confirmation
cron (mpesa-polling) → re-query stkQuery for stuck pendings (safety net)
```

**Pesapal** — redirect/IPN:

```
app → POST /api/payments/pesapal/initiate {orderId}
  api → SubmitOrder; persist pesapal_transactions(pending); store tracking id on order
      → return redirect_url; app sends customer to Pesapal
Pesapal → GET/POST /api/webhooks/pesapal (IPN, body NOT trusted)
  api → re-query GetTransactionStatus (authoritative) → VERIFY amount → credit order
```

**COD**: `place_order` sets status `received` immediately; payment collected on
delivery. No gateway call.

**Money safety invariants** (enforced): amounts always recomputed server-side
(`place_order`), the charge is always `order.total_kes` from the DB, an order is
credited **at most once** (guarded update `neq('payment_status','paid')`), and a
paid amount that doesn't match is **held for manual reconcile**, never
auto-credited (added this pass).

---

## 8. Gap & issue register (consolidated)

Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low. Status reflects this pass.

### Architecture / wiring

| #    | Sev | Issue                                                                        | Status / fix                                                                |
| ---- | --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AR-1 | 🔴  | Apps bypass the API; payments never initiated from checkout.                 | **Open** — primary migration work (route apps through `@optex/api-client`). |
| AR-2 | 🔴  | Admin Payments / Analytics / Prescriptions show hardcoded fixtures.          | **Open** — wire to API admin endpoints (data already exists server-side).   |
| AR-3 | 🟠  | Business rules duplicated across API and `@optex/db` (two sources of truth). | **Open** — after migration, `@optex/db` writes are retired.                 |
| AR-4 | 🟡  | `@optex/api-client` (~80% of routes) is dead code until apps adopt it.       | **Open** — resolved by AR-1/AR-2.                                           |

### Payments

| #     | Sev | Issue                                                                                         | Status / fix                                                                                                                                                                              |
| ----- | --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAY-1 | 🔴  | Paid amount not verified before crediting (M-Pesa callback + Pesapal reconcile).              | **Fixed this pass** — amount checked; mismatch held for reconcile.                                                                                                                        |
| PAY-2 | 🟠  | Pesapal reconcile silently overwrote the authoritative `amount_kes` with the provider figure. | **Fixed this pass** — original amount preserved; provider figure stored in `raw`.                                                                                                         |
| PAY-3 | 🟠  | Webhooks unsigned and raw body not captured.                                                  | **Partly fixed** — `rawBody` now enabled. NOTE: Daraja/Pesapal don't sign; real controls are amount-verify (done) + re-query (done for Pesapal) + **IP allow-list (recommended, infra)**. |
| PAY-4 | 🟡  | Multiple STK pushes per order create orphan pending rows.                                     | **Open** — add "pending STK exists for this order?" guard before push.                                                                                                                    |
| PAY-5 | ⚪  | No index on `mpesa_transactions.received_at` / `orders.payment_method` for reconcile views.   | **Open** — add indexes (migration).                                                                                                                                                       |

### Orders / checkout

| #     | Sev | Issue                                                                                | Status / fix                                                              |
| ----- | --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| ORD-1 | 🔴  | Checkout not atomic (best-effort insert + compensation could orphan an order).       | **Fixed this pass** — switched to `place_order` RPC (single transaction). |
| ORD-2 | 🟠  | Promo-usage increment was a racy read-modify-write (cap could be exceeded).          | **Fixed this pass** — `place_order` calls atomic `increment_promo_uses`.  |
| ORD-3 | 🟡  | `place_order` / `increment_promo_uses` RPCs shipped in `0008` but were never called. | **Fixed this pass** — root cause of ORD-1/ORD-2.                          |

### Auth / API hardening

| #     | Sev | Issue                                                                     | Status / fix                                                                    |
| ----- | --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| API-1 | 🟠  | `auth.getUser()` network round-trip on every authed request.              | **Open** — verify JWT locally with `SUPABASE_JWT_SECRET` (perf + availability). |
| API-2 | 🟡  | Exception filter echoed raw error messages in non-prod (info disclosure). | **Fixed this pass** — generic message always; stack only logged.                |
| API-3 | 🟡  | Admin role enforcement.                                                   | **Verified OK** — all admin controllers carry `@Roles('super_admin')`.          |
| API-4 | ⚪  | Container ran as root, no healthcheck, no signal reaper.                  | **Fixed this pass** — non-root, `tini`, `HEALTHCHECK`.                          |

### Schema / data

| #    | Sev | Issue                                                                                               | Status / fix                                      |
| ---- | --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| DB-1 | 🟠  | No RBAC/staff model (blocks appointment assignment + CR-01).                                        | **Open** — add `staff` table + `staff_role` enum. |
| DB-2 | 🟠  | No inventory ledger / stock-movement audit.                                                         | **Open** — `inventory_transactions` table.        |
| DB-3 | 🟡  | No audit log on admin mutations.                                                                    | **Open** — `audit_log` table + triggers.          |
| DB-4 | 🟡  | Missing constraints: `customers.phone` UNIQUE, prescription optical ranges, order money-math CHECK. | **Open** — additive migration.                    |
| DB-5 | ⚪  | No soft-delete; deletes cascade (product → order_items history).                                    | **Open** — `is_active`/archival policy.           |

### Scale (deferred by decision — single instance)

| #    | Sev | Issue                                                             | Status / fix                                                                                                                |
| ---- | --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | 🟡  | In-memory throttler won't share across replicas.                  | **Deferred** — Redis adapter before scaling out.                                                                            |
| SC-2 | 🟡  | In-process cron double-runs across replicas (duplicate SMS/work). | **Deferred** — distributed lock before scaling out. Reminder idempotency flags (`0008`) must still be used by the cron job. |

---

## 9. What was fixed in this pass

All changes typecheck (`pnpm --filter @optex/api typecheck` clean).

1. **Atomic checkout (ORD-1/ORD-2/ORD-3).** `OrdersService.checkout()` now calls
   the `place_order` Postgres RPC (migration 0008) — order + items + atomic promo
   bump + cart clear in one transaction. Removed the best-effort/compensation
   sequence, the racy `incrementPromoUses`, and the now-duplicated money-math
   constants. `apps/api/src/modules/orders/orders.service.ts`.
2. **Payment amount verification (PAY-1).** M-Pesa callback success and Pesapal
   reconcile now confirm the paid amount equals `tx.amount_kes` before crediting;
   mismatches are recorded and held for manual reconcile.
   `apps/api/src/modules/payments/payments.service.ts`.
3. **No silent amount overwrite (PAY-2).** Pesapal reconcile keeps the
   authoritative charge amount and stores the provider-reported figure in `raw`.
4. **Raw body capture (PAY-3).** `rawBody: true` enabled in `main.ts`; comment
   corrected to reflect that the real controls are amount-verify + re-query +
   IP allow-list (these providers don't sign callbacks).
5. **Exception filter (API-2).** Never echoes raw error messages; generic message
   - server-side stack + `requestId` correlation.
6. **Docker hardening (API-4).** Non-root `node` user, `tini` PID 1,
   `/api/health` `HEALTHCHECK`; new root `docker-compose.yml`; completed
   `.env.example`.

---

## 10. Roadmap to launch

**Phase A — connect the rails (launch-blocking)**

- Route `apps/web` checkout through `POST /api/checkout`, then
  `POST /api/payments/{mpesa/stk-push,pesapal/initiate}`; poll status.
- Deploy the API with public HTTPS; set `MPESA_CALLBACK_URL` / `PESAPAL_IPN_URL`;
  register the Pesapal IPN.
- Replace admin Payments/Analytics/Prescriptions fixtures with API calls.
- Verify SMS/email confirmations fire end-to-end.

**Phase B — harden & migrate reads**

- Move remaining app reads onto `@optex/api-client`; retire `@optex/db` writes.
- Local JWT verification (API-1); add reconcile indexes (PAY-5); STK dedupe
  (PAY-4); webhook IP allow-list.
- Additive constraints migration (DB-4).

**Phase C — CR-01 foundations**

- `staff` + RBAC (DB-1), inventory ledger (DB-2), audit log (DB-3), then the
  Inventory / Doctor-consultation / Analytics / Branch-P&L features.

**Before scaling out (only if needed)**

- Redis throttler + distributed cron lock (SC-1/SC-2).

---

## 11. Assumptions & open questions

- **Supabase region** is assumed nearest-Kenya (EU). Confirm the actual project
  region so the API can be colocated (drives §6 latency).
- **Traffic** assumed low / single instance. If multi-branch concurrency grows,
  trigger the scale path in §6.
- **COD** is treated as immediately `received` with payment pending — confirm
  this matches Optex's fulfilment policy.
- **Daraja/Pesapal** are assumed to provide no callback signature (true as of
  their current docs); revisit if a signed-event option is enabled.
- **Flat 300 KES delivery / free pickup** is hardcoded in `place_order`. Confirm,
  or introduce a shipping-rates table.

---

## 12. API-only frontend (no direct Supabase) — target & migration

**Decision (reaffirmed):** the apps depend ONLY on `@optex/api-client`. Supabase
(DB, Auth, Storage) becomes an internal implementation detail of the API. The
frontends import no `@optex/db` and no `@supabase/*`.

### Auth proxy — DONE (backend)

The API now proxies Supabase GoTrue so the frontend authenticates through the API:

| Endpoint                 | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `POST /api/auth/login`   | email/password → `{ session, user }` (access + refresh tokens) |
| `POST /api/auth/signup`  | create account → session (when confirmation off)               |
| `POST /api/auth/refresh` | refresh token → new session                                    |
| `POST /api/auth/logout`  | revoke session (bearer)                                        |
| `GET /api/auth/me`       | current user from the bearer token                             |

Implemented in `apps/api/src/modules/auth/*` (`AuthFlowService` forwards to GoTrue
with the anon key). Exposed on the client as `api.auth.*`. Verified end-to-end
(login → me → refresh). Requires `SUPABASE_ANON_KEY` in `apps/api/.env`.

### Frontend migration phases (remaining)

1. **Token store + client wiring.** Store `{accessToken, refreshToken}` in a
   cookie (so middleware can gate server-side); `createApiClient.getAccessToken`
   reads it; auto-refresh on 401 via `api.auth.refresh`.
2. **Web auth.** Rewrite `AuthContext`, `login`/`signup`/`forgot-password`/
   `reset-password` to call `api.auth.*`; drop `createBrowserSupabase`.
3. **Web middleware.** Gate on the API token cookie (verify/refresh) instead of
   `@supabase/ssr`.
4. **Web data.** Move every read/write (`catalog`, `product`, `cart`,
   `checkout` ✓, `orders`, `appointments`, `prescriptions`, `reviews`,
   `branches`, `search`, `account`) onto `api.*`; remove `@optex/db` imports.
5. **Admin auth + data.** Same for the admin app (Payments ✓, Orders ✓ already on
   the API); migrate the remaining screens, reconciling any API gaps first
   (e.g. analytics payment-method breakdown).
6. **Cleanup.** Remove `@optex/db` and `@supabase/*` from both apps'
   `package.json` and `transpilePackages`; `@optex/db` stays a backend-only dep.

Each phase ends with a build. Reads can stay server-rendered by calling the API
from Server Components with `fetch` caching.
