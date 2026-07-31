# Contributing to OPTEX Platform

## Branch naming

| Type      | Pattern                     | Example                     |
| --------- | --------------------------- | --------------------------- |
| Feature   | `feat/<scope>-<short-desc>` | `feat/web-product-filters`  |
| Bug fix   | `fix/<scope>-<short-desc>`  | `fix/api-mpesa-callback`    |
| Tech debt | `tech-debt/<short-desc>`    | `tech-debt/docker-supabase` |
| Chore     | `chore/<short-desc>`        | `chore/update-lockfile`     |
| Docs      | `docs/<short-desc>`         | `docs/runbook-deploy`       |

Scopes: `web`, `admin`, `api`, `db`, `ui`, `config`, `docker`, `infra`

## Commit messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short summary>

<optional body — explain WHY, not what>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

Examples:

```
feat(api): add M-Pesa STK push endpoint
fix(web): correct cart total rounding for KES fractional amounts
chore(docker): pin Kong to 2.8.1 for declarative config compatibility
```

## Pull request checklist

- [ ] Branch is up to date with `main`
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` succeeds
- [ ] New SQL migrations are numbered sequentially and idempotent
- [ ] `packages/db/src/database.types.ts` regenerated after any schema change (`pnpm db:types`)
- [ ] Env variables added to the relevant `.env.example` and `.env.production.example`
- [ ] No real secrets committed (`.env.local`, `.env`)

## Code style

- **TypeScript strict mode** is on in `apps/web` and `apps/api` — no `any`, no `!` assertions without a comment
- **No comments** unless the WHY is non-obvious
- **No unused imports** — CI will catch them
- Prefer editing existing files over creating new ones
- UI: use `@optex/ui` primitives and `cn()` for class merging; use brand tokens (`brand-blue`, `brand-red`, `brand-dark`) not raw hex

## Database migrations

- Never edit an existing migration file once it has been applied (tracked by `_docker.migrations`)
- New migrations must be idempotent: use `IF NOT EXISTS`, `OR REPLACE`, `DO $$ ... IF NOT EXISTS $$`
- RLS policies must cover all four operations (SELECT / INSERT / UPDATE / DELETE) for each role
- After every migration: regenerate types and commit `database.types.ts`

## Adding a new API endpoint

1. Add the NestJS module under `apps/api/src/modules/<name>/`
2. Register the module in `apps/api/src/app.module.ts`
3. Add the corresponding typed method to `packages/api-client/src/client.ts`
4. Add an e2e test in `apps/api/test/`

## Payments and webhooks

M-Pesa and Pesapal webhook handlers live in `apps/api/src/modules/payments/webhooks.controller.ts`. Webhook routes must:

- Verify the incoming payload signature before any DB write
- Return 200 immediately (Daraja times out at 5 s)
- Use the service-role Supabase client (bypasses RLS) for transaction writes

## Local Supabase

Always use Docker, not the Supabase CLI, for local development:

```bash
pnpm docker:up     # start
pnpm docker:reset  # wipe and restart
```

Do not commit `supabase/.temp/` or `supabase/.branches/` — they are gitignored.
