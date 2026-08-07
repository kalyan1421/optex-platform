# OPTEX — 12-Week Team Plan (3 Interns)

**Date:** 2026-08-03
**Companion to:** [ROADMAP.md](ROADMAP.md) — the *what* and *why*. This doc is the *who* and *when*.
**Team:** 3 full-stack interns (TS + React + Node/Nest), 12 weeks full-time · **36 person-weeks**
**Merge gate:** Kalyan reviews every PR
**Kalyan owns:** payments (M-Pesa + Pesapal), client communication, all production credentials
**Sequencing basis:** no fixed go-live → ordered by risk, not by date

---

## 0. The two constraints that shaped this plan

**1. Review throughput is the bottleneck, not developer capacity.** Three full-time people generate 6–9 PRs a week. All of them land on one reviewer. If review is spent on "does this still work," the plan stalls in week 3. So CI and a smoke suite are **week-1 work, before the interns' first feature PR** — not a nice-to-have at the end. Everything below assumes review is about design and correctness, because a machine already answered the mechanical questions.

**2. Vertical slices, not horizontal waves.** ROADMAP's waves are horizontal (all writes, then all reads) and **do not parallelise** — Waves 1 and 2 touch the same 7 admin components. Three people on those would conflict daily. This plan re-cuts the same work into **three domains with disjoint file ownership**. Nobody edits anybody else's files.

---

## 1. Domain ownership

Assigned so that each intern owns a domain end-to-end — API endpoint, admin screen, storefront page — and never edits another's files.

### Intern A — Catalogue & Storefront
The largest and most SEO-critical slice. Gets the render-mode rewrite because it's the same files.

| Layer | Files owned |
| --- | --- |
| API | `modules/catalog/*` — gaps **G-2** (products incl. inactive), **G-5** (`GET /categories/:slug`) |
| Admin | `components/admin/Products.tsx` |
| Web | `app/shop`, `app/product/[slug]` (incl. the review write), `app/category/[slug]`, `app/search`, `components/home/{FeaturedProducts,TrendingNow,FeaturedCollection}.jsx` |
| Data | Catalogue importer (Section 1 sheet → `products`) |

### Intern B — Appointments, Branches & Locations
Owns the live bug. Also owns the largest client-input dependency.

| Layer | Files owned |
| --- | --- |
| API | `modules/appointments/*`, `modules/branches/*` — gap **G-3** (admin branch list incl. inactive), plus slot-engine work |
| Admin | `components/admin/Appointments.tsx`, `components/admin/Branches.tsx` |
| Web | `app/appointments`, `app/branch-locator` |
| Data | 27-branch seed, hours normalisation, geocoding |

### Intern C — Cart, Account & Admin Ops
Broadest but shallowest. Good first slice for building confidence across the stack.

| Layer | Files owned |
| --- | --- |
| API | gaps **G-1** (`PATCH /admin/prescriptions/:id`), **G-4** (payment-method breakdown), **G-8** (dashboard/analytics shape adapter) |
| Admin | `components/admin/{Promotions,Prescriptions,Dashboard,Analytics}.tsx` |
| Web | `context/CartContext.js`, `app/cart`, `app/profile`, `app/orders/[id]/tracking`, `app/order-confirmation/[orderId]` |

### Shared — needs a convention, not an owner

`packages/api-client`, `packages/ui`, `packages/validators`, both `middleware.*`, `lib/api.*`, `AuthContext.js`.

**Rule: changes to `packages/*` go in their own PR, land first, and get announced.** Never bundled into a feature PR. This is the one place three people can genuinely collide.

**Nobody touches:** `modules/payments/*`, `modules/cron/*`, auth session handling. Kalyan's.

---

## 2. Phase I — Weeks 1–3: Foundation & admin migration

**Goal:** CI exists, the live bug is dead, admin makes zero business-data Supabase calls.

### Week 1 — Kalyan, before/alongside onboarding

| Task | Why it's yours |
| --- | --- |
| Send the consolidated client email ([ROADMAP Part F](ROADMAP.md)) | 3-day turnaround promised; everything in Phase II depends on it |
| CI pipeline — `typecheck` + `build` + API e2e on every PR | There is no `.github/` at all today. This is the review-bottleneck fix |
| ESLint config across the monorepo (TD-5) | `pnpm -r lint` is currently broken — a root script that fails trains people to ignore red |
| Smoke suite: shop → PDP → cart → checkout | Zero tests today. Required before anyone rewrites render modes in Phase III |
| Confirm `Business model.xlsx` supersedes `filled.xlsx` §2 (C-4) | Building from the garbled file produces garbage |

### Week 1 — All three interns (onboarding, parallel)

1. Docker stack up, migrations applied, seed loaded, all three apps running (`:1111` / `:1112` / `:1113`). **Validate this on day 1** — if the stack is broken, that's the whole week.
2. Read `ROADMAP.md` Parts B and D. Then read [`Orders.tsx`](apps/admin/components/admin/Orders.tsx) — it is already migrated and is the reference pattern for every ticket in Phase I.
3. **First PR each, deliberately trivial**, to exercise the pipeline: A → fix the wrong schema comment at [`0001_init_schema.sql:31`](Backend/supabase/migrations/0001_init_schema.sql:31) (`{mon:{open,close}}` should be `{mon:["09:00","18:00"]}` — the code and seed both use the array form, and an intern will trust the comment and lose an afternoon). B → seed the 27 real branches (name/address/phone/manager only — see §5). C → delete the duplicate contact route (`web/app/api/contact/route.ts` duplicates Nest `POST /api/contact`).

### Weeks 2–3 — Kill all 13 browser-side writes

| Intern | Tickets |
| --- | --- |
| **A** | `Products.tsx` → `admin.products.{create,update,remove}`. **Removes the `as any` at [:254](apps/admin/components/admin/Products.tsx:254).** Then G-2, then the read side. |
| **B** | `Appointments.tsx` → `admin.appointments.update`. **This fixes the live double-booking bug** — priority ticket of the phase. Then `Branches.tsx` → `admin.branches.update` + G-3. |
| **C** | Build **G-1** first (endpoint doesn't exist), then `Prescriptions.tsx`. Then `Promotions.tsx` → `admin.promos.*` / `admin.banners.*`. |

**Free feature for C:** `POST`/`DELETE /api/admin/promo-banners` already exist but `Promotions.tsx` has no banner create/delete UI at all. Wire it while you're in the file.

**Phase I exit criteria** — all must be true:
- `grep -rn "@optex/db" apps/admin/components/` returns **nothing**
- CI green on `development`; smoke suite passing
- An admin can no longer double-book an appointment slot (write a test for exactly this)

---

## 3. Phase II — Weeks 4–6: Web migration & client input lands

Client input should have arrived in week 1. If it hasn't, everything here still runs — nothing in Phase II blocks on it except where marked.

| Intern | Weeks 4–6 |
| --- | --- |
| **A** | Web catalogue reads → API: `shop`, `search`, home components. PDP review write → `api.reviews.create()`. **G-5.** Build the catalogue importer against the Section 1 column shape. ⟵ *ingestion needs client data; the importer does not* |
| **B** | Web `appointments` → `api.appointments.create()`, `branch-locator` → `api.branches.list()`. Then the **slot-engine work** in §5 — the real one. ⟵ *needs Section 4* |
| **C** | `CartContext.js` → `api.cart.*`. `cart` promo → `api.cart.applyPromo()` (**removes the browser-side discount maths**). `profile`, `orders/tracking`, `order-confirmation` (**replaces the 5s DB poll**). Then **G-4 + G-8**, then `Dashboard.tsx` / `Analytics.tsx` — closing TD-8's hardcoded chart. |

**Kalyan, in parallel:** M-Pesa + Pesapal end-to-end against the live credentials. Both are unblocked and both sit at "⏭ UPCOMING" on the client's own tracker — the most visible progress available. Also: remove COD from checkout, hide the promotions UI, rewrite the policy pages to say what the client actually said (no refunds, pickup + Wells Fargo).

**Phase II exit:** `@optex/db` appears in `apps/web` only in `middleware.js`, `context/AuthContext.js`, `lib/api.js` and the four auth pages. That's the auth-only residue — and per [ROADMAP D.4](ROADMAP.md), that is where we stop.

---

## 4. Phase III — Weeks 7–9: Render rewrite, catalogue, eTIMS

The highest-risk phase. Do not start it without Phase I's CI and smoke suite.

| Intern | Weeks 7–9 |
| --- | --- |
| **A** | **G-7 first** (SSR-capable api-client — `web/lib/api.js` is `'use client'`, so Server Components cannot use it today; Wave 5 is impossible without this). Then `shop`, `product/[slug]`, `category/[slug]`, `search` → **Server Components**, `generateMetadata` per product/category, server-side JSON-LD. Convert `.jsx` → `.tsx` in the same pass. Then catalogue ingestion. |
| **B** | Wells Fargo pickup-station checkout (C-3). This replaces the address form with a station picker and needs geo-scoped free-delivery rules. ⟵ *needs the station list* |
| **C** | **eTIMS / CR-02 scoping spike** — KRA e-invoice API research, schema design, a written scope + estimate you can quote from. Then implementation if the quote is signed. Fallback if not: test coverage and accessibility. |

**On A's Phase III:** this is the SOW's SEO and Core Web Vitals deliverable, currently unmet. `category/[slug]` is the only Server Component in the app today — it's the template. Expect this to take the full three weeks and expect the PRs to be large; consider pairing on the first page and letting the rest follow the established pattern.

**Wave 6 (enforcement) lands at the end of Phase III:** ESLint `no-restricted-imports` banning `@optex/db` outside `middleware.*`, `lib/api.*`, and the auth pages; add `typecheck` to `apps/web`. This is what stops the debt coming back — and it's worthless before Phases I–III are done.

---

## 5. The appointments problem — Intern B's real work

Four things Section 4 was supposed to answer came back blank, and the code has assumptions baked in where the answers should go.

| Code today | Section 4 asked | Gap |
| --- | --- | --- |
| `SLOT_MINUTES = 30` **hardcoded** at [appointments.service.ts:33](apps/api/src/modules/appointments/appointments.service.ts:33) | "15 / 30 / 60 minutes" | Config, per branch. Currently a global constant. |
| **1 booking per slot** — `takenTimes()` blocks any taken time | "1 optometrist / Multiple" | Needs a capacity column and a count-based check, not a set-membership check |
| **No buffer/lunch support at all** — `generateSlots(open, close)` is a straight range | "Buffer / lunch break time?" | **Missing code**, not just missing config |
| Per-weekday `{mon:["09:00","18:00"], sun:null}` | "Working days / weekly off days" | Client gave one string per branch ("9am - 6pm"), no weekday breakdown, no off-day |

**Branch seeding splits three ways** — say this to B on day 1 so they don't promise a finished locator:

- **Ready now:** name, address, phone, manager for all 27.
- **Needs client:** per-weekday hours. We have `"9am - 6pm"`; the schema needs `{mon:[...], tue:[...], sun:null}`.
- **Blocked:** `lat`/`lng` drive the locator and we have coordinates for **zero of 27** — only 4 branches supplied Maps links, and geocoding the rest needs the Google Maps API key the client says they don't have.

---

## 6. Phase IV — Weeks 10–12: conditional

You picked CR-01 (if unblocked), eTIMS, and quality. CR-01 has a **go/no-go gate**, because two things must be true and neither is today.

### Gate — decide by end of week 6

1. Section 5 returned and answered — including the delivery-model question the form itself marks "CRITICAL — ANSWER FIRST"
2. CR-01 commercially quoted **and signed** (`PLAN.md` §8 decision #14)

If either is false at week 6, **do not start CR-01.** 13 of the 14 open decisions in `PLAN.md` §8 are open today; building against guesses wastes three people for three weeks.

### If the gate opens

RBAC is foundational — inventory, doctor, and analytics all read from it. It also touches auth across all three apps, so it is the **highest conflict-risk work in the whole plan**. One person, focused window, everyone else on independent work.

| Intern | Weeks 10–12 |
| --- | --- |
| **C** | **CR-01.2 RBAC first** (7 roles, permission matrix, branch-scoped filtering, audit log). Then CR-01.3 Branch P&L — parallel-safe, and it follows their Dashboard/Analytics work. |
| **A** | CR-01.1 Inventory ledger schema + stock movements. Follows their catalogue ownership. CR-01.4 product analytics depends on this ledger, so ledger-first is not optional. |
| **B** | CR-01.5 Doctor consultation — extends their appointments module. **Blocked on RBAC** for the Doctor role, so weeks 10–11 are schema, consultation types, and the DPA 2019 consent flow; role wiring lands after C's RBAC. |

### If the gate stays shut

Weeks 10–12 go to quality and hardening — the option that is never blocked: real test coverage across all three apps, accessibility, Core Web Vitals, and eTIMS implementation if that quote signed.

**Note on what is *not* here:** the Flutter app. You didn't pick it, and it's the right call — the API is already built to serve it, so it loses nothing by waiting, and the Play Console account still doesn't exist.

---

## 7. Working agreements

**Branching.** Feature branches off `development`. One domain per branch. Branch names `<intern>/<domain>-<ticket>`.

**PR size.** Under ~400 changed lines. A 2,000-line PR is not reviewable and will sit. Phase III's render rewrite is the exception — split it per page, one page per PR.

**`packages/*` changes ship alone.** Own PR, lands first, announced to the other two. This is the only real collision surface.

**Definition of Done:**
- CI green (typecheck, build, lint, e2e)
- No new `@optex/db` import outside the auth allowlist
- Manually verified against the running dev stack — screenshot or short recording in the PR
- Docs updated if behaviour changed

**Blocked protocol.** Blocked more than half a day → say so immediately, move to the next ticket in your own domain. Never sit idle waiting on client input; every intern has independent work queued in their own domain by design.

**Review cadence.** Stagger merges so three large PRs don't land on the same afternoon. Suggested: A merges Mon/Thu, B Tue/Fri, C Wed. Adjust once you see real throughput.

---

## 8. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| **Review bottleneck stalls the team** | High | CI + smoke suite in week 1; hard PR size cap; staggered merge days. This is the single most likely failure mode. |
| Client input slips past 3 days | Medium | Every week-1 and week-2 slice is independent of it. Only Phase II's appointment config and catalogue *ingestion* have a real dependency. |
| Phase III render rewrite regresses the storefront | Medium | Smoke suite is a hard prerequisite. Split per page. Pair on the first one. |
| CR-01 gate stays shut, weeks 10–12 unplanned | Medium | Quality/hardening is the pre-agreed fallback and is never blocked. |
| Three interns collide in `packages/*` | Medium | Shared-package PRs ship alone and land first. |
| `lat`/`lng` never arrive → locator ships without a map | Medium | Ship a list-based locator with addresses; the map is a progressive enhancement. |
| Currency question (C-1) answered as USD | Low, high impact | M-Pesa settles in KES only; every schema column is `*_kes`. Escalate immediately if they say USD — this is structural, not cosmetic. |

---

## 9. Capacity

| Phase | Weeks | Person-weeks | Content |
| --- | --- | --- | --- |
| I | 1–3 | 9 | Foundation, CI, all 13 writes killed |
| II | 4–6 | 9 | Web migration, dashboard, client input absorbed |
| III | 7–9 | 9 | Render rewrite + SEO, catalogue, Wells Fargo, eTIMS scope |
| IV | 10–12 | 9 | CR-01 (gated) or quality/hardening |
| **Total** | | **36** | |

Kalyan's own track runs in parallel: week 1 foundation, weeks 4–6 payments go-live, continuous review, client management throughout.
