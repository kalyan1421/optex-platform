# Sprint Plan — Sprint 1

**Dates:** Mon 2026-08-11 → Fri 2026-08-22 (10 working days) · **Team:** Kalyan + 3 interns
**Revises:** [TEAM-PLAN.md](TEAM-PLAN.md) Phase I weeks 1–2. The [code review](CODE-REVIEW.md) changed the priority order — see *What changed* below.

---

## Sprint Goal

> **Close the three critical defects that let a customer get free glasses, and stand up the CI and smoke suite that should have caught them.**

Everything else in this sprint exists to serve that sentence or to keep three interns productively onboarded while it happens.

## What changed since TEAM-PLAN.md

TEAM-PLAN Phase I opened with CI, then the 13 browser-side writes. That was the right call against the information available. The code review found three **critical** defects inside features already marked ✅ — including an unauthenticated path to mark an order paid without paying ([CODE-REVIEW C-1](CODE-REVIEW.md)).

Three consequences:

1. **Payments move from "Kalyan's week 4–6 track" to "Sprint 1 P0."** There is no useful go-live conversation until C-1 is closed.
2. **CI stops being about intern throughput and becomes the go-live gate.** These defects shipped and were marked done because nothing tested them.
3. **The smoke suite moves off Kalyan** onto Intern C. Kalyan cannot own CI, the critical payment fix, all client communication, and every PR review in the same two weeks. Something had to move, and writing smoke tests is genuinely good onboarding.

## Capacity

Build capacity only. First-sprint onboarding is charged at 3 days per intern (environment, codebase reading, first trivial PR) — that time is real and pretending otherwise is how sprint 1 plans fail.

| Person | Available days | Build capacity | Notes |
| --- | --- | --- | --- |
| **Kalyan** | 10 | **5 pts** | ~50% consumed by PR review, client management, and production credentials. This is not padding — it is the observed bottleneck. |
| **Intern A** — Catalogue & Storefront | 10 | **7 pts** | 3 days onboarding |
| **Intern B** — Appointments & Branches | 10 | **7 pts** | 3 days onboarding |
| **Intern C** — Cart, Account & Admin Ops | 10 | **7 pts** | 3 days onboarding |
| **Total** | | **26 pts** | 1 pt ≈ 1 focused engineer-day |

**Planned capacity:** 26 pts · **Sprint load:** 20 pts · **73% committed**

The 27% buffer is deliberate. First sprint with a new team, an unresolved spike inside the P0 work, and a client response that may land mid-sprint and demand attention.

## Sprint Backlog

### P0 — Must ship

| # | Item | Est | Owner | Spec | Dependencies |
| --- | --- | --- | --- | --- | --- |
| 1 | **CI pipeline** — typecheck + build + API e2e on every PR | 2 | Kalyan | — | None. **Day 1–2. Everything else depends on it.** |
| 2 | **M-Pesa callback re-query + mandatory amount verification** — closes C-1 | 2 | Kalyan | [SPEC-01 R1, R2](specs/SPEC-01-payment-integrity.md) | Spike Q1 first (½ day) |
| 3 | **PostgREST injection fix** — closes C-2 | 1 | Kalyan | [SPEC-01 R3](specs/SPEC-01-payment-integrity.md) | Same file as #2 — one PR |
| 4 | **Migration 0009: revoke `place_order` / `increment_promo_uses` from `authenticated`** — closes C-3 | 1 | Kalyan | [SPEC-01 R4](specs/SPEC-01-payment-integrity.md) | Independent of #2/#3 |
| 5 | **Payment regression tests** — forged callback, injection, cross-customer RPC | 1 | Kalyan | [SPEC-01 R7](specs/SPEC-01-payment-integrity.md) | Needs #1 |
| 6 | **Smoke suite** — shop → PDP → cart → checkout | 3 | Intern C | — | Needs #1. Hard prerequisite for SPEC-03 later. |
| 7 | **Appointment capacity constraint + concurrency test** — closes H-2 | 2 | Intern B | [SPEC-04 R1](specs/SPEC-04-appointment-scheduling.md) | Build capacity-aware, default 1 — see risk R4 |
| 8 | **`Appointments.tsx` → API** — closes the admin double-booking bypass | 2 | Intern B | [SPEC-04 R2](specs/SPEC-04-appointment-scheduling.md) | Pairs with #7 |
| 9 | **`Products.tsx` → API** — removes the `as any` at `Products.tsx:254` | 2 | Intern A | [ROADMAP Wave 1](ROADMAP.md) | None |
| 10 | **G-1: `PATCH /api/admin/prescriptions/:id`** + `Prescriptions.tsx` → API | 2 | Intern C | [ROADMAP D.0](ROADMAP.md) | Endpoint does not exist — build first |
| | **P0 subtotal** | **18** | | | |

### P1 — Should ship

| # | Item | Est | Owner | Dependencies |
| --- | --- | --- | --- | --- |
| 11 | `adminLinkPayment` amount + state check (M-1); reject COD server-side (M-3) | 1 | Kalyan | After #2–#5 |
| 12 | ESLint config across the monorepo — `pnpm -r lint` is currently broken | 1 | Intern A | None. Config only; enforcement lands later. |
| | **P1 subtotal** | **2** | | |

### Onboarding — all three interns, days 1–3 (already charged to capacity)

- **Day 1: validate the Docker stack end to end.** Migrations applied, seed loaded, all three apps running on `:1111` / `:1112` / `:1113`. *If this is broken, that is the week — escalate immediately, do not debug quietly.*
- Read [ROADMAP.md](ROADMAP.md) Parts B and D, then [CODE-REVIEW.md](CODE-REVIEW.md), then `admin/components/admin/Orders.tsx` — already migrated, and the reference pattern for tickets 8, 9 and 10.
- **One trivial first PR each**, to exercise the pipeline before anything substantive:
  - **A** → fix the wrong `hours` shape comment at `Backend/supabase/migrations/0001_init_schema.sql:31` (documents `{mon:{open,close}}`; code and seed both use `{mon:["09:00","18:00"]}` — an intern will trust it and lose an afternoon)
  - **B** → seed the 27 real branches: name, address, phone, manager only ([SPEC-04 R4](specs/SPEC-04-appointment-scheduling.md))
  - **C** → delete `web/app/api/contact/route.ts`, which duplicates Nest `POST /api/contact` — two Resend integrations, one form

### Explicitly not in this sprint

| Deferred | Why |
| --- | --- |
| All of [SPEC-03](specs/SPEC-03-storefront-seo-render.md) (SEO / render rewrite) | Hard prerequisite is CI + smoke suite, which is *this* sprint's ticket 6. Starting it now repeats the mistake the code review found. |
| [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) Phase 2 (pickup stations, shipping rules) | Blocked on client B1–B3 |
| [SPEC-04](specs/SPEC-04-appointment-scheduling.md) Phase 2 (duration, capacity, breaks) | Blocked on client Section 4 (A5, A6) |
| Stock check at checkout ([SPEC-02 R2](specs/SPEC-02-checkout-fulfilment.md)) | Real and serious (H-1), but needs the client's out-of-stock rule (H1). Sprint 2 candidate; not a guess-and-build. |
| `Promotions.tsx`, `Branches.tsx`, `Dashboard`, `Analytics` migrations | Sprint 2. Capacity, not priority. |
| Anything CR-01 | Gate is shut — Section 5 blank, nothing quoted or signed |

## Kalyan's non-build track (runs alongside, not counted in capacity)

| Task | When | Why now |
| --- | --- | --- |
| **Send the consolidated client email** — [CLIENT-QUESTIONS.md](CLIENT-QUESTIONS.md), now including the new Block H | **Day 1** | Block A has been outstanding since the input form went out. Every week of delay pushes SPEC-02 and SPEC-04 Phase 2 out by a week. |
| Flag C-1 to the client as a go-live blocker | Day 1, in the same email | Already drafted in Block H. Tell them; do not quietly close a critical payment defect. |
| Confirm `Business model.xlsx` supersedes `filled.xlsx` §2 (C-4) | Day 1 | Building from the garbled file produces garbage |
| PR review, staggered | Continuous | A merges Mon/Thu, B Tue/Fri, C Wed |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | **Kalyan is simultaneously the only reviewer, the owner of all P0 payment work, and the client contact.** | **High** | Sprint goal missed | Load is planned at 5 of 10 days. Intern PR volume is deliberately low in sprint 1 (one trivial + one substantive each). If review starts slipping, cut ticket 11 first, then ticket 5's scope — never ticket 1. |
| R2 | **Spike Q1 unresolved:** does Daraja `stkQuery` return a definitive result fast enough to answer the callback inline? | Medium | Reshapes ticket 2 | Time-boxed to ½ day, day 3. If inconclusive, ack-then-reconcile-asynchronously is the fallback and is already correct behaviour — the existing polling cron covers it. |
| R3 | **Docker stack broken on day 1** | Medium | Loses an intern-week | Validate on day 1 before anything else. Escalate within the hour, do not debug silently. |
| R4 | **Ticket 7 encodes capacity = 1**, which is exactly what client question A6 asks about | Medium | Follow-up migration on a live bookings table | Build the constraint capacity-aware from the start with a default of 1. Costs little now; a migration on live bookings costs a lot later. |
| R5 | **Client answers Block A mid-sprint** and it demands immediate attention | Medium | Distraction | Good problem. Absorb into the buffer; do not re-scope mid-sprint. Route into Sprint 2 planning. |
| R6 | **Interns hit the `packages/*` collision surface** | Low | Merge conflicts | Shared-package changes ship in their own PR, land first, and get announced. No exceptions. |
| R7 | **More critical defects exist in code marked ✅** | Medium | Unknown | Three of eight review findings were criticals in "done" features. The smoke suite (ticket 6) and CI (ticket 1) are the systemic answer. Treat "marked done" as unverified until tested. |

## Definition of Done

Per [TEAM-PLAN §7](TEAM-PLAN.md), plus two additions this sprint:

- [ ] CI green — typecheck, build, e2e
- [ ] No new `@optex/db` import outside the auth allowlist
- [ ] Manually verified against the running dev stack — screenshot or short recording in the PR
- [ ] Docs updated if behaviour changed
- [ ] **PR under ~400 changed lines**
- [ ] **New:** every security fix ships with the regression test that would have caught the original defect
- [ ] **New:** if a ticket touches a feature marked ✅ in [FEATURE-STATUS.md](FEATURE-STATUS.md), that status is re-verified rather than assumed

## Exit criteria

The sprint succeeds if all of these are true on Fri 2026-08-22:

- [ ] A forged M-Pesa callback cannot credit an order — proven by a test in CI, not by inspection
- [ ] A crafted `CheckoutRequestID` cannot select another customer's transaction
- [ ] A logged-in customer cannot call `place_order` with another customer's id
- [ ] Two concurrent bookings for the same slot produce exactly one appointment
- [ ] An admin cannot double-book a slot from the panel
- [ ] CI runs on every PR and the smoke suite passes
- [ ] `grep -rn "@optex/db" apps/admin/components/admin/{Appointments,Products,Prescriptions}.tsx` returns nothing
- [ ] The client email is sent and the response window has opened

## Key Dates

| Date | Event |
| --- | --- |
| **Mon 11 Aug** | Sprint start · Docker validation (all) · Client email out (Kalyan) · CI begins |
| **Wed 13 Aug** | CI green on `development`. **If not, stop and fix — everything downstream depends on it.** |
| **Thu 14 Aug** | Spike Q1 resolved; ticket 2 shape decided |
| **Fri 15 Aug** | Mid-sprint check-in. Onboarding complete, all three trivial PRs merged, substantive tickets underway |
| **Wed 20 Aug** | Feature freeze — P0 code complete, remaining time to review and fix |
| **Fri 22 Aug** | Sprint end · demo against the exit criteria above |
| **Mon 25 Aug** | Retro · Sprint 2 planning (re-plan against whatever the client returned) |

---

## Sprint 2 preview (not committed)

Shape only, so the team can see where their work leads:

- **If the client answers Block A:** catalogue importer against the real column shape, appointment configuration ([SPEC-04](specs/SPEC-04-appointment-scheduling.md) Phase 2), stock rule ([SPEC-02 R2/R7](specs/SPEC-02-checkout-fulfilment.md)).
- **If they don't:** finish the admin migration (Promotions, Branches, Dashboard, Analytics + gaps G-2/G-3/G-4/G-8), [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) Phase 1 (VAT single source, configurable delivery rules), and G-7 to unblock SPEC-03.

Both paths are full sprints. No intern is ever blocked on the client — that is by design, and it is worth protecting.
