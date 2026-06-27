# OPTEX — Local Runbook

How to run the full stack: **Supabase** (DB/Auth/Storage) → **API** (NestJS, `:4000`)
→ **Web** storefront (`:3000`) → **Admin** panel (`:3001`), plus the **Docker**
path for the API.

| Service | Port | URL | Start command |
|---|---|---|---|
| Supabase API | 54321 | http://127.0.0.1:54321 | `cd Backend && supabase start` |
| Supabase Studio | 54323 | http://127.0.0.1:54323 | (started with the above) |
| NestJS API | 4000 | http://localhost:4000/api · docs `/api/docs` · health `/api/health` | `pnpm dev:api` |
| Web storefront | 3000 | http://localhost:3000 | `pnpm dev:web` |
| Admin panel | 3001 | http://localhost:3001 | `pnpm dev:admin` |

Dependency order: **Supabase must be up first** (API + apps need it). API should be
up before you exercise checkout/payments in the apps.

---

## 0. Prerequisites (one-time)

```bash
# Node 20+ and pnpm (via corepack, version pinned in package.json)
node -v            # must be >= 20
corepack enable    # provides pnpm 10.32.1

# Supabase CLI (local DB/Auth/Storage)
brew install supabase/tap/supabase   # macOS; see supabase.com/docs/guides/cli otherwise

# Docker Desktop — only needed for the Docker path (§5). Supabase CLI also needs Docker.
```

---

## 1. Install workspace deps

```bash
cd /Users/kalyan/Client-project/OPTEX
pnpm install        # links all workspace packages (api-client, db, ui, …)
```

---

## 2. Start Supabase + load schema/seed

```bash
cd Backend
supabase start      # boots Postgres(:54322) + API(:54321) + Studio(:54323) in Docker
                    # applies migrations 0001–0008 and seed.sql on first start
```

`supabase start` prints credentials — **copy these**, you need them for the env files:

```
API URL:        http://127.0.0.1:54321
Studio URL:     http://127.0.0.1:54323
anon key:       eyJ... (NEXT_PUBLIC_SUPABASE_ANON_KEY)
service_role:   eyJ... (SUPABASE_SERVICE_ROLE_KEY)
DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Re-apply migrations + reseed at any time (destructive):

```bash
supabase db reset           # local: drop, re-run all migrations, re-seed
```

For a **hosted** project instead of local:

```bash
supabase link --project-ref <ref>
supabase db push            # apply migrations to the cloud DB
# Use the dashboard's Project URL + anon + service_role keys in the env files below.
```

### Create the super-admin user

The admin panel requires a Supabase user with `app_metadata.role = 'super_admin'`
(server-controlled; set via the service role — migration 0007). If the seed didn't
create one, set it on an existing user against the local DB:

```bash
# 1. Sign up a user (via the admin /login page or Studio → Authentication).
# 2. Promote it (run against the local DB URL from `supabase start`):
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"role\":\"super_admin\"}' where email='you@example.com';"
```

---

## 3. Configure environment files

Three env files, all filled from the `supabase start` output. **Note the different
variable names**: the API uses `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; the
Next.js apps use `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```bash
# API  (apps/api/.env)  — required vars fail boot if missing
cp apps/api/.env.example apps/api/.env
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   (M-Pesa/Pesapal/SMS/email keys optional until you wire live providers)

# Web  (apps/web/.env.local)
cp apps/web/.env.example apps/web/.env.local
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#   NEXT_PUBLIC_API_URL=http://localhost:4000

# Admin (apps/admin/.env.local)
cp apps/admin/.env.example apps/admin/.env.local
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#   NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 4. Run the apps (dev mode)

> Paste-safe note: do NOT paste commands with trailing `# comments` into an
> interactive **zsh** shell — zsh passes `#…` as arguments (you'll see
> `Invalid project directory ... /#` and `zsh: number expected`). Paste the bare
> commands below. Also, each dev server blocks its terminal — run them in
> separate tabs, not stacked in one.

### Option A — three terminals (clearest logs)

Terminal 1 — API (`:4000`, Swagger at `/api/docs`):

```bash
pnpm dev:api
```

Terminal 2 — web storefront (`:3000`):

```bash
pnpm dev:web
```

Terminal 3 — admin panel (`:3001`):

```bash
pnpm dev:admin
```

### Option B — one terminal (all dev servers in parallel)

Runs `dev` in `@optex/api`, `@optex/web`, `@optex/admin` together (logs interleave;
use Option A when debugging a single service):

```bash
pnpm -r --parallel run dev
```

### Smoke test

API health (expect `{"status":"ok",...}`):

```bash
curl -s http://localhost:4000/api/health
```

Then open in a browser: http://localhost:4000/api/docs (Swagger),
http://localhost:3000 (storefront), http://localhost:3001 (admin — log in as the
super-admin user).

---

## 5. Docker path (API container)

The API ships a hardened multi-stage Dockerfile and a root `docker-compose.yml`.
The build context is the **monorepo root** (it needs the pnpm workspace lockfile).

```bash
# from repo root
docker compose up --build api      # builds + runs the API on http://localhost:4000
docker compose logs -f api         # tail logs
docker compose down                # stop
```

Or build/run the image directly:

```bash
docker build -f apps/api/Dockerfile -t optex-api .
docker run --rm -p 4000:4000 --env-file apps/api/.env optex-api
```

**Important — DB host from inside the container:** `localhost` inside the container
is the container, not your Mac. When the API runs in Docker but Supabase runs on the
host (`supabase start`), point the API at the host:

```
# in apps/api/.env (Docker-only)
SUPABASE_URL=http://host.docker.internal:54321
```

(`docker-compose.yml` already maps `host.docker.internal`.) For a **hosted** Supabase
project, use the cloud URL and no mapping is needed.

The web/admin apps are not containerized here — run them with `pnpm dev:web` /
`pnpm dev:admin` (or deploy to Vercel). The Docker path covers the long-lived API
(it needs a persistent process for cron + payment webhooks).

---

## 6. Payment webhooks in local dev (optional)

M-Pesa Daraja callbacks and Pesapal IPN must reach your API over **public HTTPS**.
For local testing, expose `:4000` with a tunnel and point the providers at it:

```bash
cloudflared tunnel --url http://localhost:4000     # or: ngrok http 4000
# then in apps/api/.env:
#   MPESA_CALLBACK_URL=https://<tunnel>/api/webhooks/mpesa
#   PESAPAL_IPN_URL=https://<tunnel>/api/webhooks/pesapal   (register to get PESAPAL_IPN_ID)
```

COD needs no provider config — it works out of the box.

---

## 7. Build / verify (CI-style)

```bash
pnpm typecheck      # tsc --noEmit across all packages
pnpm build          # production build of every package/app
pnpm lint           # next lint + tsc per package
```

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| API exits at boot: "Invalid environment configuration" | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing in `apps/api/.env`. |
| App error: "Missing required env var: NEXT_PUBLIC_SUPABASE_URL" | Create `apps/web/.env.local` / `apps/admin/.env.local` and **restart** the dev server (Next reads env at startup). |
| Checkout/payments fail in the web app | API not running, or `NEXT_PUBLIC_API_URL` wrong. Confirm `curl :4000/api/health`. |
| CORS error in browser console | Add the app origin to `CORS_ORIGINS` in `apps/api/.env` (defaults cover `:3000` and `:3001`). |
| Admin pages redirect to /login forever | The signed-in user lacks `app_metadata.role = 'super_admin'` (see §2). |
| Docker API can't reach DB | Use `SUPABASE_URL=http://host.docker.internal:54321` (§5), not `localhost`. |
| Port already in use | Stop the stale process, or change the port (`-p` in the app's dev script / `PORT` for the API). |
