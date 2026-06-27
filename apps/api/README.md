# @optex/api

NestJS 11 backend API for the OPTEX eyewear retail platform (Optex Opticians, Kenya).
Express adapter, CommonJS build, Supabase as the data + auth backend.

This is the **foundation** layer: configuration, logging, security, auth guards,
a global error envelope, and a health check. Feature modules (products, orders,
cart, payments, etc.) are layered on top.

## Prerequisites

- Node >= 20
- pnpm 10 (the repo is a pnpm workspace)

## Setup

From the **monorepo root** (`/Users/kalyan/Client-project/OPTEX`):

```bash
pnpm install
```

Then configure environment:

```bash
cp apps/api/.env.example apps/api/.env
# fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY at minimum
```

Required vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are validated at
boot via a Zod schema — the process refuses to start if they're missing.

## Run

```bash
# from the repo root
pnpm --filter @optex/api dev     # nest start --watch
# or the root convenience script
pnpm dev:api
```

Other scripts (run with `pnpm --filter @optex/api <script>`):

| Script      | What it does                       |
| ----------- | ---------------------------------- |
| `dev`       | `nest start --watch`               |
| `build`     | `nest build` → `dist/`             |
| `start`     | `node dist/main.js`                |
| `typecheck` | `tsc --noEmit`                     |
| `lint`      | type-check (no eslint wired yet)   |

The server listens on `PORT` (default **4000**), all routes are under `/api`:

- `GET /api/health` — public liveness check
- `/api/docs` — Swagger UI

## Architecture

```
src/
  main.ts              bootstrap: helmet, CORS, global prefix, validation,
                       Swagger, pino logger
  app.module.ts        wires Config, Logger, Throttler, Schedule + feature
                       modules; registers global guards + exception filter
  config/env.ts        Zod env schema + validate() for @nestjs/config
  supabase/            @Global service-role client + token verification
  auth/                @Public/@Roles/@CurrentUser decorators, SupabaseAuthGuard,
                       RolesGuard (both registered globally)
  common/              AllExceptionsFilter (consistent JSON error envelope)
  health/              liveness controller (terminus-ready)
```

### Auth model

- Every route requires a valid `Authorization: Bearer <supabase-access-token>`
  **unless** marked `@Public()`.
- `SupabaseAuthGuard` verifies the token against Supabase Auth and attaches
  `{ id, email, role }` to `request.user`.
- `@Roles('super_admin')` + `RolesGuard` gate role-restricted routes. Role is
  read from `app_metadata.role` (trusted) then `user_metadata.role`.

### Error envelope

All errors return:

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "error": "Not Found",
  "message": "...",
  "path": "/api/...",
  "requestId": "...",
  "timestamp": "2026-06-17T00:00:00.000Z"
}
```

## Adding a feature module

```bash
# e.g. products
src/products/
  products.module.ts      # import into AppModule
  products.controller.ts  # @Public() for public reads, @Roles() for admin writes
  products.service.ts     # inject SupabaseService, query via this.supabase.client
  dto/                    # validation DTOs
```

Inject `SupabaseService` anywhere (it's global) and query via
`this.supabase.client.from('products')...`.

**Payment webhooks** (M-Pesa Daraja callback, Pesapal IPN) need the raw request
body for signature verification — see the note in `main.ts` for enabling
raw-body capture when that module lands.

## Docker

The Dockerfile is a workspace-aware multi-stage build. **Build context must be
the monorepo root:**

```bash
# from the repo root
docker build -f apps/api/Dockerfile -t optex-api .
docker run --env-file apps/api/.env -p 4000:4000 optex-api
```
