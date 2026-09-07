# CI/CD secrets and variables

Everything GitHub Actions needs, what it is for, and what happens without it.

Set at **Settings → Secrets and variables → Actions**, which has two tabs:

- **Secrets** — encrypted, masked in logs, unreadable after saving. For anything
  that grants access.
- **Variables** — plain text, visible in logs and to anyone who can read the
  workflow output. For values that are public by design.

Choosing the wrong tab is not cosmetic. A secret in Variables leaks; a public
value in Secrets is merely inconvenient — so when in doubt, use Secrets.

> Nothing in this file is currently set, and **CI is green without any of it**.
> Everything below is required only for the deployment steps that are not yet
> wired up. Add each one when the thing it points at actually exists — a
> `DEPLOY_WEBHOOK_URL` with no host behind it moves a failure rather than
> fixing one.

---

## Secrets

### `DEPLOY_WEBHOOK_URL`

**Needed for:** the `deploy` job in `.github/workflows/cd.yml`.
**Without it:** the job skips with a notice. The api image is still published
to GHCR; nothing is rolled out.

A URL your container host exposes meaning _"pull the new image and restart"_.
POST to it and the host does the rest. Not a standard — a shape most non-AWS
hosts happen to share, which is why the deploy step keys on it rather than
committing the repo to one provider.

| Host                           | Where to find it                                                                |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Render                         | Service → Settings → **Deploy Hook**                                            |
| Railway                        | Project → Settings → **Webhooks**                                               |
| Coolify / Dokploy              | Application → **Webhooks** → deploy URL                                         |
| Watchtower (plain Docker host) | its HTTP API update endpoint                                                    |
| Fly.io                         | **none** — Fly deploys via `flyctl`, so that step needs rewriting, not a secret |

Treat it as a credential: anyone holding it can trigger a deploy.

---

## Variables

These three are variables rather than secrets **on purpose**. They are
`NEXT_PUBLIC_*`, which Next.js inlines into the client bundle at build time —
they are shipped to every browser that loads the site. Putting them in Secrets
would be theatre, and would also mask them in build logs where seeing them is
often how you diagnose a bad build.

They are **only** required if `apps/web` / `apps/admin` are added back to the
image matrix in `cd.yml`. Today Vercel builds and deploys both apps straight
from the repo, and CD publishes the api image alone.

**Without them, if web/admin are in the matrix:** buildx runs with empty
build-args and the Next build dies inside prerendering with
`[@optex/db] Missing required env var: NEXT_PUBLIC_SUPABASE_URL`. That is not a
hypothetical — it is why CD failed on four consecutive merges before the matrix
was scoped down.

| Variable                        | Value                                                       |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL, e.g. `https://<ref>.supabase.co`      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** key — Project Settings → API              |
| `NEXT_PUBLIC_API_URL`           | public origin of `apps/api`, e.g. `https://api.example.com` |

Because these are inlined at build time, an image is **bound to the Supabase
project and API origin it was built against**. A different environment means a
different image, not the same image with different runtime env.

---

## Never put these here

### `SUPABASE_SERVICE_ROLE_KEY`

It bypasses RLS completely. No build needs it, and no workflow in this repo
reads it. It belongs only in the API's own runtime environment, on the host.

### Anything from `apps/api/.env`

M-Pesa Daraja, Pesapal, Africa's Talking and Resend credentials are **runtime**
config for the API process. They are set wherever the API is hosted, not in
GitHub Actions — CI never calls those providers, and the e2e suite runs against
the throwaway local stack.

---

## What CI uses today

`.github/workflows/ci.yml` needs **nothing configured**. Its Supabase values are
the well-known local-dev demo keys, committed in the workflow's `env:` block on
purpose: they are not secrets, and they only ever address the disposable
Supabase container the workflow starts for itself.

`.github/workflows/cd.yml` authenticates to GHCR with the built-in
`GITHUB_TOKEN`, which requires no setup. That is why the registry is GHCR — the
build half of the pipeline runs for real on every merge instead of waiting on
credentials somebody has to create first.
