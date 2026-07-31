# @optex/db

Typed Supabase clients + query helpers, shared by `apps/web` and `apps/admin`.

## Entry points

| Import | Use from | Notes |
|---|---|---|
| `@optex/db/browser` | Client components | Cached singleton browser client |
| `@optex/db/server` | Server Components / Route Handlers / Server Actions | Bound to the calling request's cookies |
| `@optex/db/service` | Trusted server-only (webhooks, jobs) | Uses **service-role** key, bypasses RLS |
| `@optex/db` (root) | Anywhere | Types + query helpers (`listProducts`, `createOrder`, `isSuperAdmin`, …) |
| `@optex/db/types` | Anywhere | Raw `Database` type only |

## Required env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only, never expose to the browser
```

`env.ts` throws at first access if any of these is missing — we'd rather fail
fast in dev than late-bind a null error during a payment callback.

## Regenerating `database.types.ts`

The file is **generated** from the local Docker Compose Postgres (it was hand-derived historically; regenerating is now the only supported path, so do not hand-edit it — your edits will be overwritten). Run from the repo root:

```bash
pnpm db:types
```

…which runs `supabase gen types typescript --db-url …localhost:54322…` against the **local Docker Compose** Postgres and overwrites `packages/db/src/database.types.ts`. Bring the stack up first (`docker compose up -d supabase-kong`).
