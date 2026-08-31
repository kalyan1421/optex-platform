Asan Innovators | Deployment Options — Services Per Component & Cost Comparison — OPTEX | Version 1.0 | 2026-08-24
Prepared by: Kalyan Kumar Bedugam (AK)

# OPTEX — Deployment Options: Services Per Component & Cost

Three ways to host `apps/api` (NestJS), `apps/web` (Next.js storefront), and `apps/admin` (Next.js staff panel): **AWS** (from the earlier [AWS_DEPLOYMENT_ARCHITECTURE.md](AWS_DEPLOYMENT_ARCHITECTURE.md) doc), and two cheaper alternatives.

**Key assumption driving the cost gap:** Options B and C **keep Supabase** (Postgres + Auth + Storage) exactly as it runs today, instead of migrating to RDS + Cognito + S3. That's not just an infra-cost difference — the AWS option's biggest cost is the engineering effort to rewrite every `auth.jwt()`-based RLS policy and the two SECURITY DEFINER functions before cutover (see the AWS doc, §2 and §13). Options B and C avoid that entirely: same Supabase backend, different (cheaper) place to run the three app containers. If that assumption is wrong — i.e. you want all three options fully off Supabase — say so and I'll redo B/C with a self-hosted Postgres cost line instead.

---

## Option A — AWS (ECS Fargate + RDS + Cognito + S3)

Full detail in [AWS_DEPLOYMENT_ARCHITECTURE.md](AWS_DEPLOYMENT_ARCHITECTURE.md). Summary below.

### Services Per Component

| Component | Service |
|---|---|
| `apps/api` | ECS Fargate + ALB |
| `apps/web` | ECS Fargate + ALB, CloudFront |
| `apps/admin` | ECS Fargate + ALB |
| Database | RDS PostgreSQL Multi-AZ (replaces Supabase Postgres) |
| Auth | Cognito User Pool (replaces Supabase Auth) |
| File storage | S3 (replaces Supabase Storage) |
| Scheduled jobs | EventBridge Scheduler → ECS RunTask |
| Secrets | Secrets Manager |
| Monitoring | CloudWatch |
| CI/CD | GitHub Actions → ECR → ECS |

### Monthly Cost

| | Production | Staging | Combined |
|---|---:|---:|---:|
| Early-stage | $465 | $159 | **≈ $624/mo (~KES 81,000)** |
| Growth-stage | $1,200 | — | **≈ $1,200+/mo (~KES 156,000)** |

---

## Option B — Vercel + Render + Supabase (managed PaaS, split by strength)

Each app goes to the platform best suited to it; Supabase stays untouched.

### Services Per Component

| Component | Service | Why this one |
|---|---|---|
| `apps/web` | **Vercel** (Pro plan) | Next.js's own platform — SSR, ISR, image optimization, and edge CDN work out of the box with zero config, which matters most for the SEO-facing storefront |
| `apps/admin` | **Vercel** (same account, second project) | Same reasoning; internal traffic is low so it rides comfortably inside the Pro plan's included usage |
| `apps/api` | **Render** (Web Service, Docker — reuses `apps/api/Dockerfile` as-is) | NestJS is a long-running process with cron jobs and webhook receivers — a poor fit for Vercel's serverless functions, a good fit for Render's always-on containers |
| Scheduled jobs (reminders, notification retries) | **Render Cron Jobs** (native feature) | First-class recurring-job support, no separate scheduler service needed |
| Database / Auth / Storage | **Supabase Cloud, Pro plan** (unchanged) | Already running today; Pro tier (8GB DB, 100GB storage, daily backups) covers early-stage load |
| CDN | **Vercel Edge Network** (built in) | No separate CDN service or bill |
| Secrets | Render + Vercel encrypted env vars | Adequate at this scale; no dedicated secrets-manager cost. Trade-off: less centralized/auditable than AWS Secrets Manager — acceptable for a two-vendor small-team setup |
| DNS | **Cloudflare** (free) | Free tier covers a single storefront + admin + API subdomain setup |
| Monitoring / logs | Render + Vercel built-in dashboards, **Axiom or Better Stack free tier** for log retention beyond each platform's default window | Both platforms' own log retention is short; a free-tier log drain closes that gap cheaply |
| CI/CD | Existing `.github/workflows/ci.yml` + Vercel/Render's native git-push auto-deploy | Both platforms redeploy on push to `main` without extra pipeline code |

### Monthly Cost

| Item | Production | Staging |
|---|---:|---:|
| Vercel Pro (web + admin, one seat) | $20 | included (preview deploys are free) |
| Vercel usage overage (bandwidth/functions past included quota) | $10–20 | $0 |
| Render — API web service (Standard, 1GB) | $25 | $7 (Starter) |
| Render — Cron Jobs | $5 | $0 |
| Supabase Pro | $25 | $0 (use a free-tier Supabase project for staging) |
| Log retention (Axiom/Better Stack free tier) | $0–10 | $0 |
| Cloudflare DNS | $0 | $0 |
| Misc (domain, buffer) | $5 | $2 |
| **Subtotal** | **≈ $95/mo** | **≈ $9/mo** |
| **Combined** | | **≈ $104/mo (~KES 13,500/mo)** |

**Growth-stage** (traffic ~4–5x): Vercel Pro overages rise (~$100–150/mo), Render API steps up to a larger instance + a second instance for HA (~$80–100/mo), Supabase steps up compute add-ons (~$100–150/mo), log tooling to a paid tier (~$30/mo) → **≈ $400–450/mo**.

---

## Option C — DigitalOcean App Platform + Supabase (single vendor, flat pricing)

All three apps on one platform and one bill; Supabase stays untouched.

### Services Per Component

| Component | Service | Why this one |
|---|---|---|
| `apps/api` | **DO App Platform** Web Service (Docker, `apps/api/Dockerfile`) — Basic tier | Same container, no rewrite; DO's flat per-instance pricing is the cheapest predictable compute of the three options |
| `apps/web` | **DO App Platform** Web Service (Next.js buildpack or Docker) — Basic tier | DO auto-detects Next.js; static assets served through DO's included CDN at no extra charge |
| `apps/admin` | **DO App Platform** Web Service — Basic-XXS tier | Low-traffic internal tool, smallest instance size is sufficient |
| Scheduled jobs | **DO Functions** (serverless, pay-per-invocation) triggering the API's sweep endpoints, or a $6/mo micro-Droplet running cron | DO Functions cost pennies at this call volume; the Droplet is the fallback if a persistent process is preferred |
| Database / Auth / Storage | **Supabase Cloud, Pro plan** (unchanged) | Same as Option B — no migration cost or effort |
| CDN | **DO App Platform's built-in CDN** | Included free with every App Platform service — no separate line item, unlike AWS's CloudFront |
| Secrets | DO App Platform encrypted environment variables | Same trade-off as Option B — fine at this scale |
| DNS | **DO's built-in DNS** or Cloudflare (free) | Either works; DO's is one less account to manage |
| Monitoring | **DO App Platform built-in metrics + alerts** (included, no extra cost) | Covers CPU/memory/restart alerts out of the box |
| CI/CD | Existing `.github/workflows/ci.yml` + DO App Platform's git-push auto-deploy | Same pattern as Option B |

### Monthly Cost

| Item | Production | Staging |
|---|---:|---:|
| DO App Platform — `apps/api` (Basic, 1 instance) | $12 | $5 (Basic-XXS) |
| DO App Platform — `apps/web` (Basic, 1 instance) | $12 | $5 |
| DO App Platform — `apps/admin` (Basic-XXS) | $5 | $5 |
| Scheduled jobs (DO Functions) | $1 | $0 |
| Supabase Pro | $25 | $0 (free-tier project for staging) |
| DNS | $0 | $0 |
| Misc (domain, buffer) | $5 | $2 |
| **Subtotal** | **≈ $60/mo** | **≈ $17/mo** |
| **Combined** | | **≈ $77/mo (~KES 10,000/mo)** |

**Growth-stage** (traffic ~4–5x): each app steps up to Professional-XS/S tiers with 2 instances for HA (~$150–180/mo total compute), Supabase compute add-ons (~$100–150/mo), Functions/misc scale modestly (~$20/mo) → **≈ $280–350/mo**.

---

## Comparison Summary

| | **A: AWS** | **B: Vercel + Render** | **C: DigitalOcean** |
|---|---|---|---|
| Early-stage combined cost | ≈ $624/mo | ≈ $104/mo | ≈ $77/mo |
| Growth-stage cost | ≈ $1,200+/mo | ≈ $400–450/mo | ≈ $280–350/mo |
| Migration effort from today | High — full Supabase→AWS-native rewrite (§2 of AWS doc) | None — Supabase unchanged, only compute moves | None — Supabase unchanged, only compute moves |
| Ops complexity | Highest — VPC, IAM, ECS, multiple AWS services to manage | Low — two managed platforms, minimal config | Lowest — one platform, one bill |
| Vendor count | 1 (AWS) + external payment/SMS/email providers | 3 (Vercel, Render, Supabase) + external providers | 2 (DigitalOcean, Supabase) + external providers |
| Best fit | Later, if OPTEX needs enterprise procurement (AWS Activate/EDP), fine-grained IAM, or scale well past 50K users | Team that wants best-in-class Next.js hosting and doesn't mind two dashboards | Simplest possible bill and ops surface, closest to what the project's own local-dev/Docker setup already assumes |

**Recommendation for OPTEX's current stage (single-market Kenya launch, no fixed scale target yet):** Option C. It's the cheapest, keeps Supabase's RLS/RBAC model that R1 was built against with zero rework, and DigitalOcean already appears as the intended production target in the project's own architecture defaults. Option B is the fallback if Next.js-specific platform features (ISR, edge middleware) become load-bearing for the storefront. Option A stays the right call only if there's a specific reason to be on AWS already (compliance requirement, existing AWS spend commitment, or outgrowing both PaaS options).

---

Confidential — Asan Innovators © 2026 | Building Beyond Boundaries
