# OPTEX — Runbook (Local + Production)

One place to run every part of the stack — **Supabase** (DB/Auth/Storage/Kong),
**API** (NestJS), **Web** storefront, and **Admin** panel — in local dev and in
production.

| Service                 | Local port                            | Local URL                                                       | Production                                                   |
| ----------------------- | ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Supabase gateway (Kong) | 54321                                 | http://localhost:54321                                          | Hosted Supabase project (`https://<ref>.supabase.co`)        |
| Supabase Studio         | 54323                                 | http://localhost:54323                                          | Supabase dashboard                                           |
| Postgres                | 54322                                 | `localhost:54322`                                               | Managed by Supabase Cloud                                    |
| NestJS API              | 4000 (Docker) / 1111 (`pnpm dev:api`) | http://localhost:4000 · docs `/api/docs` · health `/api/health` | Your container host, e.g. `https://api.optexopticians.co.ke` |
| Web storefront          | 1112                                  | http://localhost:1112                                           | Vercel, e.g. `https://optexopticians.co.ke`                  |
| Admin panel             | 1113                                  | http://localhost:1113                                           | Vercel, e.g. `https://admin.optexopticians.co.ke`            |

> Ports were moved off 3000/3001/4000 for local dev to avoid collisions with
> other local processes — `docker-compose.yml`'s **API container** still uses
> `:4000` internally; that's unrelated to the `pnpm dev:api` port (`:1111`).
> If you see `:3000`/`:3001` in older docs, they're stale.

Dependency order, both environments: **Supabase must be reachable before the
API starts; the API must be reachable before Web/Admin can check out, log in,
or hit any admin endpoint.**

---

## Part 1 — Local development

### 1.0 Prerequisites (one-time)

```bash
node -v             # must be >= 20
corepack enable      # provides pnpm 10.32.1 (pinned in package.json)
```

Docker Desktop must be running — the entire local Supabase stack (and
optionally the API) runs in Docker Compose. No Supabase CLI needed for local
dev; it's only used later for pushing migrations to a hosted project.

### 1.1 Install + configure

```bash
pnpm install

cp apps/web/.env.example   apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/api/.env.example   apps/api/.env
```

The `.example` files are pre-filled with the standard local-dev Supabase demo
keys (JWT secret `super-secret-jwt-token-with-at-least-32-characters-long`) —
no edits needed to run locally.

### 1.2 Start Supabase (+ optionally the API) via Docker

```bash
pnpm docker:up       # = docker compose up --build
```

First run builds the API image and pulls 8 Supabase service images (Postgres,
GoTrue, PostgREST, Storage, postgres-meta, Kong, Studio) — this takes a few
minutes. Migrations (`Backend/supabase/migrations/0001`–`0008`) and
`seed.sql` run automatically and idempotently via `docker/migrate.sh`
(tracked in the `_docker_migrations` table — already-applied files are
skipped on every subsequent `docker:up`).

Other Docker commands:

```bash
pnpm docker:down     # stop all services, keep data
pnpm docker:reset    # docker compose down -v && docker compose up --build — wipes the DB volume for a clean slate
```

Verify:

```bash
docker compose ps                       # every service should show "healthy"
curl -s http://localhost:4000/api/health  # {"status":"ok",...}
```

**If `docker compose up` gets stuck restarting `supabase-migrate` in a
loop** (a migration failing partway, then re-failing with `already exists`
on retry), don't try to fix it forward — `pnpm docker:reset` wipes the
volume and starts clean. Partial DDL from a failed migration doesn't roll
back on its own; `docker/migrate.sh` runs each file inside
`psql --single-transaction` specifically so a _future_ failure rolls back
cleanly instead of wedging like this.

### 1.3 Run Web and Admin

The API from step 1.2 already runs in Docker on `:4000`. Web/Admin are not
containerized — run them with pnpm, each in its own terminal:

```bash
pnpm dev:web      # http://localhost:1112
pnpm dev:admin    # http://localhost:1113
```

If you'd rather run the API outside Docker (e.g. for faster iteration with
hot-reload), stop the Docker `api` service and run it separately on `:1111`:

```bash
docker compose stop api
pnpm dev:api      # http://localhost:1111 — update NEXT_PUBLIC_API_URL in
                  # apps/web/.env.local and apps/admin/.env.local to match
```

### 1.4 Create the super-admin user (local)

The admin panel requires a Supabase user with `app_metadata.role =
'super_admin'` — **not** `user_metadata`, which any signed-up user can
rewrite client-side (see [CLAUDE.md](CLAUDE.md) for the self-escalation bug
this guards against).

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

(The `apikey`/`Authorization` value above is the well-known local-dev
service-role demo key from `docker-compose.yml` — fine to use as-is
locally, never in production.) Then sign in at http://localhost:1113/login.

### 1.5 Payment webhooks locally (optional)

M-Pesa Daraja callbacks and Pesapal IPN need to reach your API over public
HTTPS. Tunnel `:4000` (or `:1111`) and point the provider config at it:

```bash
cloudflared tunnel --url http://localhost:4000     # or: ngrok http 4000
# then in apps/api/.env:
#   MPESA_CALLBACK_URL=https://<tunnel>/api/webhooks/mpesa
#   PESAPAL_IPN_URL=https://<tunnel>/api/webhooks/pesapal   (register to get PESAPAL_IPN_ID)
```

Cash-on-delivery needs no provider config.

### 1.6 Build / verify (CI-style, run before pushing)

```bash
pnpm typecheck      # tsc --noEmit across all packages
pnpm build          # production build of every package/app (regenerates DB types first)
```

`pnpm lint` is currently broken repo-wide (`apps/web`/`apps/admin` call
`next lint` with no ESLint config installed) — don't rely on it as a gate.

### 1.7 Local troubleshooting

| Symptom                                                                              | Cause / fix                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `supabase-migrate` keeps restarting / `type "X" already exists`                      | Wedged partial migration — `pnpm docker:reset`                                                                                 |
| `supabase-studio` / `supabase/postgres-meta` image pull fails ("not found")          | Old pinned tag pruned from Docker Hub — check `docker-compose.yml` still references live tags                                  |
| API image build fails: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`                  | Needs `ENV CI=true` in `apps/api/Dockerfile` (already fixed — if it recurs, that env var got removed)                          |
| `supabase-storage` shows `unhealthy` but storage works fine                          | Healthcheck hitting `localhost` resolves to `::1`; storage only binds IPv4. Compose healthcheck should target `127.0.0.1:5000` |
| API exits at boot: "Invalid environment configuration"                               | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in `apps/api/.env`                                                        |
| Next.js: "Missing required env var: NEXT_PUBLIC_SUPABASE_URL"                        | Create `apps/web/.env.local` / `apps/admin/.env.local` and **restart** the dev server (Next reads env at startup only)         |
| Checkout/payments fail in the web app                                                | API not running, or `NEXT_PUBLIC_API_URL` wrong — confirm `curl :4000/api/health` (or `:1111`)                                 |
| CORS error in browser console                                                        | Add the app origin to `CORS_ORIGINS` in `apps/api/.env`                                                                        |
| Admin pages redirect to `/login` forever                                             | Signed-in user lacks `app_metadata.role = 'super_admin'` — see 1.4                                                             |
| Docker API can't reach a host-run Supabase (`supabase start` instead of `docker:up`) | Point `SUPABASE_URL` at `http://host.docker.internal:54321`, not `localhost`                                                   |
| Port already in use                                                                  | `lsof -i :1111 -i :1112 -i :1113 -i :54321 -i :54322 -i :54323`, kill the stale process, or `pkill -f "next dev"`              |

---

## Part 2 — Production

Production topology: **Supabase Cloud** (managed Postgres/Auth/Storage) +
**API** on a container host (Docker image, e.g. Fly.io/Railway/Render/ECS) +
**Web** and **Admin** each as an independent **Vercel** project.

### 2.1 Provision Supabase Cloud (one-time)

1. Create the project at [supabase.com](https://supabase.com).
2. Link the repo's `Backend/` to it and push migrations:

```bash
cd Backend
supabase link --project-ref <your-project-ref>
supabase db push --linked      # applies Backend/supabase/migrations/0001–0008
```

3. From the dashboard (**Project Settings → API**), collect: Project URL,
   `anon` key, `service_role` key, JWT secret. These feed every `.env.production.example` below.
4. Seed reference data (branches, categories) if `seed.sql` hasn't been
   adapted for production — review `Backend/supabase/seed.sql` first; it
   contains dev-only sample products/customers you likely don't want live.

### 2.2 Deploy the API

The API ships a hardened multi-stage Dockerfile (build context is the
**monorepo root** — it needs the root pnpm lockfile):

```bash
docker build -f apps/api/Dockerfile -t optex-api .
docker run -p 4000:4000 --env-file apps/api/.env.production optex-api
```

Push that image to your host of choice (Fly.io, Railway, Render, ECS, etc.)
and set the environment variables from
[apps/api/.env.production.example](apps/api/.env.production.example) as
secrets there — **never commit a filled-in copy**:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` — from 2.1
- `CORS_ORIGINS` — your production Web + Admin origins
- `MPESA_*` — Safaricom Daraja production credentials + a public `MPESA_CALLBACK_URL`
- `PESAPAL_*` — Pesapal production credentials + a public `PESAPAL_IPN_URL` (register it to get `PESAPAL_IPN_ID`)
- `AT_*` — Africa's Talking SMS credentials
- `RESEND_*` — transactional email

The API needs a **long-lived process** (not serverless) — it owns cron jobs
and payment webhooks, which is why it's containerized rather than deployed
to Vercel like the two frontends.

Health check for your host's readiness probe: `GET /api/health`.

### 2.3 Deploy Web and Admin (Vercel)

Each app is an independent Vercel project pointed at this monorepo:

| App   | Root directory | Build command                                  | Output  |
| ----- | -------------- | ---------------------------------------------- | ------- |
| web   | `apps/web`     | `cd ../.. && pnpm --filter @optex/web build`   | `.next` |
| admin | `apps/admin`   | `cd ../.. && pnpm --filter @optex/admin build` | `.next` |

Set environment variables per project from
[apps/web/.env.production.example](apps/web/.env.production.example) and
[apps/admin/.env.production.example](apps/admin/.env.production.example)
(Vercel Dashboard → Project → Settings → Environment Variables → select
**Production**, and separately for Preview/Staging if you use those):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from 2.1
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only; Vercel keeps non-`NEXT_PUBLIC_` vars off the client bundle, but never rename it to add that prefix
- `NEXT_PUBLIC_API_URL` — the production API URL from 2.2, e.g. `https://api.optexopticians.co.ke`
- Web only: `RESEND_API_KEY`, `CONTACT_EMAIL` (contact form)

Deploy:

```bash
vercel --prod          # run from apps/web or apps/admin, or wire the Git integration for auto-deploy on push to main
```

### 2.4 Create the production super-admin user

Same shape as local (1.4), but against the **production** Supabase project
and using its **real** service-role key (never the local demo key):

```bash
curl -s -X POST https://<project-ref>.supabase.co/auth/v1/admin/users \
  -H "apikey: <production_service_role_key>" \
  -H "Authorization: Bearer <production_service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@optexopticians.co.ke",
    "password": "<strong unique password>",
    "email_confirm": true,
    "app_metadata": { "role": "super_admin" }
  }'
```

Run this from a trusted machine only, and rotate the password immediately
after first login. Never put the service-role key in a frontend env var or
commit it anywhere.

### 2.5 Register payment webhooks

Both providers need the **production** API's public HTTPS URL, registered
before go-live:

- **M-Pesa Daraja**: `MPESA_CALLBACK_URL=https://api.optexopticians.co.ke/api/webhooks/mpesa`, configured in the Daraja portal for your shortcode.
- **Pesapal**: call `RegisterIPN` against `PESAPAL_IPN_URL=https://api.optexopticians.co.ke/api/webhooks/pesapal`, then set the returned id as `PESAPAL_IPN_ID`.

### 2.6 Post-deploy checklist

```bash
curl -s https://api.optexopticians.co.ke/api/health          # {"status":"ok",...}
curl -s https://api.optexopticians.co.ke/api/products?limit=1   # confirms DB connectivity through the API
```

- Open the Web and Admin production URLs, confirm they load and the admin
  login gate works with the account from 2.4.
- Confirm `CORS_ORIGINS` on the API matches the exact deployed Web/Admin
  origins (scheme + host, no trailing slash) — a mismatch fails silently as
  a browser CORS error, not a 4xx from the API.
- Place one COD test order end-to-end (no payment provider credentials
  required) before enabling M-Pesa/Pesapal live traffic.

### 2.7 Production troubleshooting

| Symptom                                                   | Cause / fix                                                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/Admin build fine but API calls fail in prod           | `NEXT_PUBLIC_API_URL` unset/wrong in Vercel env, or API host down — check `/api/health` directly                                                   |
| Browser console CORS errors in prod                       | API's `CORS_ORIGINS` doesn't exactly match the deployed origin                                                                                     |
| Admin login succeeds but every page redirects to `/login` | User's `app_metadata.role` isn't `super_admin` — re-run 2.4's promotion against production, and confirm you set `app_metadata` not `user_metadata` |
| M-Pesa/Pesapal callbacks never arrive                     | Callback/IPN URL not publicly reachable, or not registered with the provider — re-check 2.5                                                        |
| API container fails to boot                               | Missing required env var — same validation as local (see 1.7), check container logs for "Invalid environment configuration"                        |
| DB schema drift between environments                      | Migrations applied locally but not pushed — `cd Backend && supabase db push --linked`                                                              |

---

## Reference

| Document                                                     | Description                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| [README.md](README.md)                                       | Architecture, tech stack, package map                      |
| [COMMANDS.md](COMMANDS.md)                                   | Every dev command in one place                             |
| [CONTRIBUTING.md](CONTRIBUTING.md)                           | Branch strategy, PR process, code style                    |
| [CLAUDE.md](CLAUDE.md)                                       | Repo layout + current known-gap notes for AI-assisted work |
| [docs/AUDIT.md](docs/AUDIT.md)                               | Tech-debt audit, Figma-to-code comparison                  |
| [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md)         | SOW feature gap analysis                                   |
| [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md) | NestJS module map + API contract                           |
| [Backend/README.md](Backend/README.md)                       | Supabase CLI workflow for the hosted project               |
