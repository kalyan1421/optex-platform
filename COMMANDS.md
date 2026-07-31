# OPTEX — Commands Reference

> **Stack:** pnpm workspace monorepo · Next.js 14 · Supabase · Node ≥ 20 · pnpm ≥ 10
> Run all `pnpm` commands from the **repo root** (`/Users/kalyan/Client-project/OPTEX`) unless a different working directory is noted.

---

## 1. First-time Setup

```bash
# Install all workspace dependencies (run once, or after any package.json change)
pnpm install

# Copy env files (pre-filled with local dev keys — no editing needed for local dev)
cp apps/web/.env.example   apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/api/.env.example   apps/api/.env

# Start local Supabase + API via Docker (first run builds images, runs migrations + seed)
pnpm docker:up

# Link to a hosted Supabase project (one-time — for remote/production pushes only)
cd Backend
supabase link --project-ref <your-project-ref>
cd ..
```

---

## 2. Run Both Apps (Dev)

### Start Web Storefront — http://localhost:1112

```bash
pnpm dev:web
```

### Start Admin Panel — http://localhost:1113

```bash
pnpm dev:admin
```

### Start Both Apps Simultaneously (two terminals, or background)

```bash
# Terminal 1
pnpm dev:web

# Terminal 2
pnpm dev:admin
```

```bash
# Or both in background (logs go to /tmp/)
pnpm dev:web   > /tmp/optex-web.log   2>&1 &
pnpm dev:admin > /tmp/optex-admin.log 2>&1 &

# Tail logs
tail -f /tmp/optex-web.log
tail -f /tmp/optex-admin.log

# Stop both
pkill -f "next dev"
```

---

## 3. Build for Production

### Build all packages + apps

```bash
pnpm build
```

### Build one app individually

```bash
pnpm --filter @optex/web   build
pnpm --filter @optex/admin build
```

### Preview production build locally

```bash
# Web storefront
pnpm --filter @optex/web start      # http://localhost:1112

# Admin panel
pnpm --filter @optex/admin start    # http://localhost:1113
```

---

## 4. Supabase (Local via Docker)

> Local Supabase runs entirely through Docker Compose — no `supabase start` needed.
> Migrations in `Backend/supabase/migrations/` run automatically via `docker/migrate.sh`.

### Start local Supabase stack + API

```bash
pnpm docker:up          # first run: builds images, runs migrations + seed
```

- **Supabase gateway (Kong):** http://localhost:54321
- **Studio:** http://localhost:54323
- **Postgres direct:** `localhost:54322` (user: `postgres`, password: `your-super-secret-and-long-postgres-password`)
- **NestJS API:** http://localhost:4000 — this is the **Docker** port (`docker-compose.yml` sets `PORT=4000`). Running the API on the host with `pnpm dev:api` uses **1111** instead.

### Stop all services (data preserved)

```bash
pnpm docker:down
```

### Wipe volumes + restart (fresh database)

```bash
pnpm docker:reset
```

### Apply migrations to the hosted (production) project

```bash
cd Backend
supabase db push --linked
```

### Seed the local database manually

```bash
psql "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres" \
  -f Backend/supabase/seed.sql
```

### Open local Supabase Studio in browser

```bash
open http://localhost:54323
```

### Connect to local DB with psql

```bash
psql "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres"
```

### Run a one-off SQL file against local DB

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -f path/to/file.sql
```

---

## 5. Database Migrations

### Create a new migration file

```bash
cd Backend
supabase migration new <migration_name>
# Creates: Backend/supabase/migrations/<timestamp>_<migration_name>.sql
```

### Apply latest migration to local DB

```bash
# Compose owns the local stack — migrate.sh applies migrations/*.sql idempotently.
# Do NOT use `supabase db push` locally; it targets the CLI stack, not Compose.
docker compose up -d supabase-migrate
```

### Apply latest migration to hosted DB

```bash
cd Backend
supabase db push --linked
```

### List applied migrations

```bash
cd Backend
supabase migration list
```

### Squash migrations (compress history — use with caution)

```bash
cd Backend
supabase migration squash
```

---

## 6. Regenerate TypeScript Types from Schema

Run after any schema change (new table, column, or enum) to keep
`packages/db/src/database.types.ts` in sync:

```bash
# From repo root — targets the local Docker Compose Postgres (:54322)
pnpm db:types

# Equivalent long form
supabase gen types typescript \
  --db-url postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres \
  --schema public > packages/db/src/database.types.ts
```

> **Important:** Commit the updated `database.types.ts` after every migration.

---

## 7. Type-check & Lint

### Type-check all packages + apps

```bash
pnpm typecheck
```

### Type-check a single app

```bash
pnpm --filter @optex/admin typecheck
pnpm --filter @optex/web   typecheck
```

### Lint all packages + apps

```bash
pnpm lint
```

### Lint a single app

```bash
pnpm --filter @optex/web   lint
pnpm --filter @optex/admin lint
```

---

## 8. Code Formatting

```bash
# Format everything (TS, TSX, JS, JSX, JSON, MD, CSS)
pnpm format

# Format a specific file or directory
npx prettier --write apps/web/app/shop/page.jsx
npx prettier --write "packages/db/src/**/*.ts"
```

---

## 9. Add / Remove Dependencies

```bash
# Add a runtime dep to a specific app
pnpm --filter @optex/web   add <package>
pnpm --filter @optex/admin add <package>

# Add a runtime dep to a shared package
pnpm --filter @optex/db    add <package>
pnpm --filter @optex/ui    add <package>

# Add a dev dependency to root workspace
pnpm add -Dw <package>

# Remove a package
pnpm --filter @optex/web remove <package>
```

---

## 10. Supabase Auth — Admin Users

### Create the super_admin user via Supabase Admin API (local)

```bash
# C-1 FIX: role must go in app_metadata (not user_metadata) — only the
# service-role Admin API can write app_metadata, so it cannot be forged.
curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: <service_role_key>" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gmail.com",
    "password": "admin@123",
    "email_confirm": true,
    "app_metadata": { "role": "super_admin" },
    "user_metadata": { "full_name": "Optex Admin" }
  }'
```

### Promote an existing user to super_admin (local psql)

```bash
# C-1 FIX: role goes in raw_app_meta_data and is removed from raw_user_meta_data.
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c \
  "UPDATE auth.users
   SET raw_app_meta_data  = raw_app_meta_data  || '{\"role\":\"super_admin\"}'::jsonb,
       raw_user_meta_data = raw_user_meta_data - 'role'
   WHERE email = 'admin@gmail.com';"
```

### Fix existing super_admin users after migration 0007 (run once on any environment)

```bash
# Run this after applying 0007_security_meta.sql to migrate any users whose
# role is still in user_metadata (pre-migration state).
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c \
  "UPDATE auth.users
   SET raw_app_meta_data  = raw_app_meta_data  || '{\"role\":\"super_admin\"}'::jsonb,
       raw_user_meta_data = raw_user_meta_data - 'role'
   WHERE raw_user_meta_data ->> 'role' = 'super_admin';"
```

---

## 11. Environment Variables

### Required `.env.local` for `apps/web` and `apps/admin`

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — see apps/web/.env.example>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server-side only, never expose>
```

The standard local dev keys are pre-filled in each app's `.env.example`.

---

## 12. Storage Buckets

Buckets are created by migration `0003_storage_buckets.sql`.
To verify or inspect them locally:

```bash
# Via Studio
open http://localhost:54323/project/default/storage/buckets

# Via psql
psql "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:54322/postgres" \
  -c "SELECT id, name, public FROM storage.buckets;"
```

Bucket layout:

| Bucket           | Public | Purpose                                      |
| ---------------- | ------ | -------------------------------------------- |
| `product-images` | Yes    | Product catalogue images                     |
| `tryon-assets`   | Yes    | Virtual try-on reference images              |
| `promo-banners`  | Yes    | Homepage banner images                       |
| `prescriptions`  | No     | Customer prescription uploads (owner-scoped) |

---

## 13. Git

```bash
# All new development — run from repo root (OPTEX/)
git status
git pull origin main
git checkout -b feat/<scope>-<desc>
git add <files>
git commit -m "feat(scope): description"
git push -u origin feat/<scope>-<desc>
```

### Legacy Frontend/ (read-only reference — frozen)

```bash
# Frontend/ has its own .git — only touch if inspecting legacy history
git -C Frontend/ log --oneline -10
```

---

## 14. Deployment

### Web storefront → Vercel

```bash
# From repo root
vercel --prod

# Or via Vercel dashboard:
# Root directory: apps/web
# Build command: cd ../.. && pnpm build --filter @optex/web
# Output:        .next
```

### Admin panel → Vercel

```bash
# Separate Vercel project
# Root directory: apps/admin
# Build command: cd ../.. && pnpm build --filter @optex/admin
# Output:        .next
```

### Push DB migrations to production

```bash
cd Backend
supabase db push --linked
```

---

## 15. Useful One-liners

```bash
# Kill all Next.js dev servers
pkill -f "next dev"

# Check which ports are in use
lsof -i :1111 -i :1112 -i :1113 -i :54321 -i :54322 -i :54323

# Reinstall all deps from scratch
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Show all workspace packages
pnpm ls -r --depth 0

# Run a script in every package simultaneously
pnpm -r --parallel run typecheck

# Inspect the resolved dependency graph for one package
pnpm why <package-name> --filter @optex/web

# Check for outdated deps
pnpm outdated -r

# Update a dep across the whole workspace
pnpm update -r <package-name>
```

---

## Quick Reference Card

| Task                        | Command                                   |
| --------------------------- | ----------------------------------------- |
| **Start web**               | `pnpm dev:web`                            |
| **Start admin**             | `pnpm dev:admin`                          |
| **Stop all dev servers**    | `pkill -f "next dev"`                     |
| Build all                   | `pnpm build`                              |
| Lint all                    | `pnpm lint`                               |
| Type-check all              | `pnpm typecheck`                          |
| Format code                 | `pnpm format`                             |
| **Start Supabase (Docker)** | `pnpm docker:up`                          |
| Stop Supabase               | `pnpm docker:down`                        |
| Reset local DB              | `pnpm docker:reset`                       |
| Push migrations (prod)      | `cd Backend && supabase db push --linked` |
| Regen DB types              | `pnpm db:types`                           |
| Install deps                | `pnpm install`                            |
| Add dep to web app          | `pnpm --filter @optex/web add <pkg>`      |
