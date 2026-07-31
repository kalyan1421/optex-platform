# OPTEX Opticians — Platform

E-commerce and operations platform for **Optex Opticians (Kenya)**. Built as a pnpm monorepo targeting the Kenya market with M-Pesa, Pesapal, and COD payments.

---

## Architecture

```
optex/
├── apps/
│   ├── web/          Next.js 14 — customer storefront  (port 1112)
│   ├── admin/        Next.js 14 — super-admin panel    (port 1113)
│   └── api/          NestJS 11  — REST API              (1111 dev / 4000 Docker)
├── packages/
│   ├── ui/           shadcn primitives shared by web + admin
│   ├── db/           Supabase types + query helpers
│   ├── api-client/   Typed fetch client for apps/api
│   ├── config/       Tailwind preset + brand tokens
│   └── validators/   Zod schemas shared across apps
├── docker/
│   ├── kong.yml      Kong 2.8.1 declarative gateway config
│   └── migrate.sh    Idempotent SQL migration runner
├── docker-compose.yml  Full local Supabase stack (9 services)
├── RUNBOOK.md        Run everything — local + production
├── Backend/
│   └── supabase/     SQL migrations + seed
└── docs/
    ├── AUDIT.md      Tech-debt audit + SOW alignment
    └── PLAN.md       8-week ship plan
```

### Service map

| Service             | Tech                                | URL                                                           |
| ------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Customer storefront | Next.js 14 App Router + Tailwind v4 | `localhost:1112`                                              |
| Admin panel         | Next.js 14 App Router + shadcn      | `localhost:1113`                                              |
| REST API            | NestJS 11 + class-validator         | `localhost:1111` (`pnpm dev:api`) · `localhost:4000` (Docker) |
| Supabase gateway    | Kong 2.8.1 (DB-less)                | `localhost:54321`                                             |
| Supabase Studio     | Official Studio UI                  | `localhost:54323`                                             |
| Postgres            | Supabase Postgres 15                | `localhost:54322`                                             |

---

## Tech Stack

| Layer           | Choice                                        |
| --------------- | --------------------------------------------- |
| Framework       | Next.js 14 (App Router, RSC)                  |
| API             | NestJS 11, class-validator, class-transformer |
| Database        | Supabase Postgres 15 + RLS + Auth + Storage   |
| Styling         | Tailwind CSS v4 (web), Tailwind v3 (admin)    |
| UI primitives   | shadcn/ui + Radix                             |
| Auth            | Supabase Auth (JWT, SSR cookie refresh)       |
| Payments        | M-Pesa Daraja STK Push · Pesapal IPN · COD    |
| SMS             | Africa's Talking                              |
| Email           | Resend                                        |
| Maps            | Google Maps JS API                            |
| Package manager | pnpm 10 workspaces                            |
| Node            | ≥ 20                                          |
| TypeScript      | 5.6 strict                                    |

---

## Quick Start

### Prerequisites

- [Node.js ≥ 20](https://nodejs.org/)
- [pnpm ≥ 10](https://pnpm.io/installation) — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)

### 1 — Install dependencies

```bash
pnpm install
```

### 2 — Copy environment files

```bash
cp apps/web/.env.example   apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/api/.env.example   apps/api/.env
```

The example files are pre-filled with standard local dev keys — no editing needed to run locally.

### 3 — Start Supabase (Docker)

```bash
pnpm docker:up
```

This starts all 9 services (Postgres, Auth, PostgREST, Storage, Kong, Studio, and the NestJS API). Migrations and seed data run automatically on first boot.

| Service                | URL                                                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| Supabase gateway (API) | http://localhost:54321                                                 |
| Supabase Studio        | http://localhost:54323                                                 |
| Postgres direct        | `localhost:54322` (user: `postgres`)                                   |
| NestJS API             | http://localhost:4000 (Docker port — `pnpm dev:api` uses 1111 instead) |

### 4 — Start the web and admin apps

```bash
# Terminal 1
pnpm dev:web      # http://localhost:1112

# Terminal 2
pnpm dev:admin    # http://localhost:1113
```

### 5 — Create the super-admin user

```bash
curl -s -X POST http://localhost:54321/auth/v1/admin/users \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDcxMzQyNSwiZXhwIjoyMTAwMDczNDI1fQ.5h1scd1HcpX3H5EZv6OfrbG5af-_eNoCyqNsRwm8ozE" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDcxMzQyNSwiZXhwIjoyMTAwMDczNDI1fQ.5h1scd1HcpX3H5EZv6OfrbG5af-_eNoCyqNsRwm8ozE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@optexopticians.co.ke",
    "password": "Admin@Optex2025!",
    "email_confirm": true,
    "app_metadata": { "role": "super_admin" }
  }'
```

---

## Docker commands

```bash
pnpm docker:up      # start all services (builds on first run)
pnpm docker:down    # stop all services (data preserved)
pnpm docker:reset   # wipe volumes + restart (fresh DB)
```

Migrations in `Backend/supabase/migrations/` run automatically via `docker/migrate.sh` on every `docker:up`. Already-applied files are skipped (tracked in `_docker_migrations`).

---

## Development workflows

### Generate TypeScript types after a schema change

```bash
# Regenerate packages/db/src/database.types.ts from local Postgres
pnpm db:types

# Types are also regenerated automatically before every pnpm build
```

### Type-check everything

```bash
pnpm typecheck
```

### Lint everything

```bash
pnpm lint
```

### Format code

```bash
pnpm format
```

### Run API e2e tests

```bash
# Requires docker compose up first
pnpm --filter @optex/api test:e2e
```

### Add a new SQL migration

```bash
# Create a numbered file in Backend/supabase/migrations/
# Name: 000N_description.sql
# It will run automatically on next docker:up
touch Backend/supabase/migrations/0009_my_change.sql
```

---

## Environment variables

### `apps/web/.env.local` and `apps/admin/.env.local`

| Variable                        | Purpose                      |
| ------------------------------- | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase gateway URL         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon JWT              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only service role JWT |
| `NEXT_PUBLIC_API_URL`           | NestJS API base URL          |

### `apps/api/.env`

| Variable                    | Purpose                         |
| --------------------------- | ------------------------------- |
| `SUPABASE_URL`              | Supabase gateway URL            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT (bypasses RLS) |
| `SUPABASE_ANON_KEY`         | Anon JWT                        |
| `SUPABASE_JWT_SECRET`       | Used to verify incoming JWTs    |
| `MPESA_CONSUMER_KEY`        | Daraja API key                  |
| `PESAPAL_CONSUMER_KEY`      | Pesapal API key                 |
| `AT_API_KEY`                | Africa's Talking API key        |
| `RESEND_API_KEY`            | Resend email API key            |

See `apps/*/env.production.example` for production variable templates.

---

## Packages

| Package             | Description                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `@optex/ui`         | shadcn Button, Card, Input, Badge, Label, Separator + `cn` + `formatKes`                            |
| `@optex/db`         | Supabase client factories (browser / server / service) + typed query helpers                        |
| `@optex/api-client` | Typed fetch wrapper for the NestJS API                                                              |
| `@optex/config`     | Tailwind preset with brand tokens (`brand.blue #2A3182`, `brand.red #E53935`, `brand.dark #1A1A2E`) |
| `@optex/validators` | Zod schemas shared across web, admin, and API                                                       |

---

## Payments

| Method              | Provider             | Status                                     |
| ------------------- | -------------------- | ------------------------------------------ |
| M-Pesa STK Push     | Safaricom Daraja API | Scaffold ready — needs sandbox credentials |
| Card / Airtel Money | Pesapal              | Scaffold ready — needs sandbox credentials |
| Cash on Delivery    | —                    | Fully wired                                |

Webhook endpoints: `POST /api/payments/mpesa/callback` and `POST /api/payments/pesapal/ipn` on the NestJS API. These must be publicly accessible — use [ngrok](https://ngrok.com/) or Vercel preview URLs for testing.

---

## Database schema

8 SQL migrations live in `Backend/supabase/migrations/`:

| File                           | Contents                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_init_schema.sql`         | Tables: branches, categories, products, inventory, customers, orders, order_items, appointments, prescriptions, product_reviews, promo_codes, mpesa_transactions, pesapal_transactions |
| `0002_rls_policies.sql`        | Row-Level Security — anon read, customer-scoped writes, super_admin full access                                                                                                        |
| `0003_storage_buckets.sql`     | product-images, tryon-assets, promo-banners (public), prescriptions (private)                                                                                                          |
| `0004_customers_trigger.sql`   | Auto-creates customers row on auth.users insert                                                                                                                                        |
| `0005_performance_indexes.sql` | FTS index on products.search_tsv, composite indexes on orders/appointments                                                                                                             |
| `0006_security_fixes.sql`      | Stricter RLS, service-role-only webhook tables                                                                                                                                         |
| `0007_security_meta.sql`       | Role claim moved to app_metadata (cannot be self-forged)                                                                                                                               |
| `0008_api_hardening.sql`       | Rate-limit helpers, additional auth guards                                                                                                                                             |

---

## Deployment

### Web + Admin → Vercel

Each app deploys as an independent Vercel project:

| App   | Root directory | Build command                                  |
| ----- | -------------- | ---------------------------------------------- |
| web   | `apps/web`     | `cd ../.. && pnpm --filter @optex/web build`   |
| admin | `apps/admin`   | `cd ../.. && pnpm --filter @optex/admin build` |

Copy `apps/web/.env.production.example` → Vercel environment variables.

### API → Docker / Railway / Render

```bash
docker build -f apps/api/Dockerfile -t optex-api .
docker run -p 4000:4000 --env-file apps/api/.env optex-api
```

See [RUNBOOK.md](RUNBOOK.md) for full local + production run steps.

---

## Project docs

| Document                                                     | Description                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [RUNBOOK.md](RUNBOOK.md)                                     | How to run everything — Docker, API, Web, Admin — in local dev and production |
| [docs/AUDIT.md](docs/AUDIT.md)                               | Full tech-debt audit, Figma-to-code comparison, SOW alignment                 |
| [docs/PLAN.md](docs/PLAN.md)                                 | 8-week ship plan                                                              |
| [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) | NestJS module map + API contract                                              |
| [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md)         | SOW features not yet implemented                                              |
| [COMMANDS.md](COMMANDS.md)                                   | Every dev command in one place                                                |
| [CONTRIBUTING.md](CONTRIBUTING.md)                           | Branch strategy, PR process, code style                                       |
| [Backend/README.md](Backend/README.md)                       | Supabase CLI workflow (for hosted project)                                    |

---

## Legacy code

`Frontend/optex-admin/` (Vite SPA) and `Frontend/optex-web/` (CRA) are **frozen read-only references**. Do not add features or deploy from them. All active development is in `apps/` and `packages/`. See [docs/AUDIT.md §11](docs/AUDIT.md) for the archival rationale.

---

## License

Private — all rights reserved. OPTEX Opticians Kenya © 2025.
