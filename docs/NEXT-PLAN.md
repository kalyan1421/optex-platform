# OPTEX — What Happens Next

**Date:** 2026-08-07 · **Basis:** [CLIENT-ANSWERS.md](CLIENT-ANSWERS.md) · [CODE-REVIEW.md](CODE-REVIEW.md) · [FEATURE-INVENTORY.md](FEATURE-INVENTORY.md)
**This is a delivery plan, not a resourcing plan.** For who does what, see [TEAM-PLAN.md](TEAM-PLAN.md).

---

## The short version

Four milestones stand between here and a store that can take a real order safely.

| # | Milestone | Gate | Blocked on client? |
| --- | --- | --- | --- |
| **M1** | **Make it safe** — close the three critical defects, add CI | Nothing can launch before this | **No** |
| **M2** | **Make it true** — backend-owned rules and content; remove what is false | Nothing should be *shown* before this | **No** |
| **M3** | **Make it complete** — lenses, stock, delivery rules, cancellation | Nothing can be *sold properly* before this | **Yes — 2 answers** |
| **M4** | **Make it findable** — SSR, metadata, sitemap, analytics | Contracted deliverable | **No** |

Then, and only then: **Phase 1B (CR-01)**, gated on a signed quote.

**The critical path is not long.** Three payment fixes, a stock check, a lens price list, a catalogue, and one delivery threshold number. Everything else is important, contracted, or valuable — but it is not what stands between here and revenue.

---

## M1 — Make it safe

**Goal:** a customer cannot get free glasses, and the next defect gets caught by a machine rather than a code review.

| Work | Spec | Why now |
| --- | --- | --- |
| M-Pesa callback re-query + mandatory amount check | [SPEC-01 R1, R2](specs/SPEC-01-payment-integrity.md) | A customer can mark an order paid without paying, today |
| PostgREST injection fix | [SPEC-01 R3](specs/SPEC-01-payment-integrity.md) | Unauthenticated caller can credit a stranger's order |
| `place_order` privilege migration | [SPEC-01 R4](specs/SPEC-01-payment-integrity.md) | Any customer can order against another's cart |
| Reject COD server-side | [SPEC-01 R6](specs/SPEC-01-payment-integrity.md) | Client removed COD; the API still creates unpaid fulfillable orders |
| Appointment slot constraint | [SPEC-04 R1](specs/SPEC-04-appointment-scheduling.md) | Two patients, one optometrist |
| Admin writes → API (13 sites) | [ROADMAP Wave 1](ROADMAP.md) | Business rules currently enforced nowhere |
| CI + smoke suite | [SPRINT-01](SPRINT-01.md) | Three criticals shipped marked ✅ because nothing tested them |

**Exit:** a forged callback cannot credit an order — proven by a test, not by inspection. CI runs on every PR.

**Detailed plan:** [SPRINT-01.md](SPRINT-01.md).

---

## M2 — Make it true

**Goal:** Optex controls their own storefront, and nothing published is false.

This is the client's *"everything from the backend only"* instruction. It splits into two halves with different urgency.

### The correctness half — launch blockers

Not feature gaps. Things currently published that are **wrong**:

| Problem | Where | Fix |
| --- | --- | --- |
| Returns policy describes a returns process | 175 hardcoded lines | Client said **no refunds**. Rewrite before launch |
| Three invented testimonials with American names | `Testimonials.jsx:4` | Delete. Hide the section until real ones exist |
| Homepage advertises Virtual Try-On | 41 lines of "smart camera technology" | Phase 3 by contract. **Ships hidden** |
| Delivery policy contradicts the confirmed model | 196 hardcoded lines | Rewrite |

Publishing invented customer reviews on a real retailer's site, and advertising a feature that does not exist, are not polish items.

### The control half

| Work | Spec |
| --- | --- |
| Settings store — delivery charge, VAT, thresholds, cancellation window | [SPEC-05 R1, R2](specs/SPEC-05-backend-owned-config.md) |
| VAT computed in one place, not two | [SPEC-05 R3](specs/SPEC-05-backend-owned-config.md) |
| Policy and homepage content editable | [SPEC-05 R4, R5](specs/SPEC-05-backend-owned-config.md) |
| Appointment rules editable — duration, capacity, break, hours | [SPEC-04 R5–R7](specs/SPEC-04-appointment-scheduling.md) |
| Setting changes audited | [SPEC-05 R6](specs/SPEC-05-backend-owned-config.md) |
| Remaining browser reads → API | [ROADMAP Waves 2–4](ROADMAP.md) |

**Exit:** Optex can change any price, rule or policy without a developer. Nothing published is false. [FEATURE-INVENTORY Part 4](FEATURE-INVENTORY.md) is empty except the auth residue.

**Why before M3:** M3 builds pricing rules. Those rules need somewhere to read from. Building M3 first means hardcoding constants we then unwind — the exact pattern this whole programme exists to fix.

---

## M3 — Make it complete

**Goal:** a customer can buy what they actually came for.

| Work | Spec | Client-blocked |
| --- | --- | --- |
| Stock check at checkout + "Out of stock" display | [SPEC-02 R2](specs/SPEC-02-checkout-fulfilment.md) | ✅ Answered — greyed out, central pool |
| Delivery charge from settings | [SPEC-02 R4](specs/SPEC-02-checkout-fulfilment.md) | ✅ Answered — KES 300, admin-editable |
| **Free-delivery threshold** | [SPEC-02 R6](specs/SPEC-02-checkout-fulfilment.md) | 🔴 **[O-1](CLIENT-ANSWERS.md) — blocking** |
| **Lens & coating configurator** | [SPEC-07](specs/SPEC-07-lens-configurator.md) | 🔴 **[O-3](CLIENT-ANSWERS.md) — blocking** |
| Customer cancellation with admin approval | [SPEC-06](specs/SPEC-06-order-lifecycle.md) | 🟡 Thresholds default-able |
| Close the guest appointment path | [SPEC-06 R6](specs/SPEC-06-order-lifecycle.md) | ✅ Answered |
| Reversed-payment visibility | [SPEC-06 R7](specs/SPEC-06-order-lifecycle.md) | ✅ Answered |
| Catalogue importer | — | 🟡 Build now, ingest when data arrives |
| Wells Fargo pickup stations | [SPEC-02 R5](specs/SPEC-02-checkout-fulfilment.md) | 🔴 Station list (B1) |
| Catalogue filters — price, shape, gender, material | [P-30…P-33](FEATURE-INVENTORY.md) | ✅ **Columns already populated — UI only** |

**The two blockers are not equal.** The delivery threshold is one number. The lens price list is the difference between selling frames and selling glasses — likely **most of the order value**, and the single highest-value unbuilt feature in Phase 1A.

**Build behind the blocks.** Both features' models, admin screens and pricing logic can be built against placeholder data. When the answers arrive it should be data entry, not development. Given how long the catalogue has taken, assume late and plan for same-day ingestion.

**Exit:** a customer can buy a complete pair of prescription glasses, see the right delivery charge, and cancel if they need to.

---

## M4 — Make it findable

**Goal:** deliver the contracted SEO and Core Web Vitals obligation.

Unblocked by client input, and currently unmet on exactly the pages that matter. 23 client components; `generateMetadata` on 1 of 21 pages; no sitemap; no robots; product JSON-LD rendering after hydration where crawlers miss it.

**Do not start before M1's CI and smoke suite exist.** Rewriting the storefront's render model with zero regression protection is the riskiest thing on this plan, and [CODE-REVIEW.md](CODE-REVIEW.md) is the evidence of what ships unnoticed when nothing tests it.

**Install analytics first.** There is no GA4, no GTM, no analytics of any kind. Without a baseline, the SEO deliverable cannot be evidenced to the client — the work will be done and unprovable.

**Detail:** [SPEC-03](specs/SPEC-03-storefront-seo-render.md).

---

## Then — Phase 1B (CR-01)

The client chose **Phase 1A first, CR-01 after**. That was the right call and this plan honours it.

**Gate status:**

| Condition | Status |
| --- | --- |
| Section 5 answered | ✅ **Open** — answered 2026-08-07 |
| Commercially quoted and signed | ❌ Outstanding |

Scope, sizing and the four blocking clarifications are in [SPEC-08](specs/SPEC-08-cr01-phase-1b.md). Two answers **shrink** the quote (POs dropped; branch P&L reduced to revenue ranking, because capex and opex both came back N/A). One **grows** it substantially: **per-frame serial tracking with FIFO valuation**, which roughly doubles the inventory model versus SKU-level.

**Four Phase 1A decisions keep Phase 1B additive rather than a rewrite.** They cost almost nothing now:

1. Stock decrement behind a **single function**, so the ledger wraps it instead of hunting call sites.
2. Settings audit written in a shape that migrates into `audit_log`.
3. A **general** appointment exclusion model, so per-doctor availability does not need a redesign.
4. `products.cost_price` added during catalogue import, not retrofitted across a live catalogue.

---

## What we need from the client

**Ordered by what it blocks. The first two are the whole list if nothing else gets answered.**

| # | Ask | Blocks | Ref |
| --- | --- | --- | --- |
| **1** | **Free-delivery threshold in KES** — "39" with KES as the currency is KES 39, less than a seventh of the KES 300 delivery charge you confirmed in the same message. And does it apply countrywide or Nairobi only? | Checkout totals | [O-1](CLIENT-ANSWERS.md) |
| **2** | **Full lens and coating price list in KES** — every type and coating, priced, and whether coatings add on top or come bundled | The entire prescription business | [O-3](CLIENT-ANSWERS.md) |
| **3** | **Real product catalogue** — with cost price. Also: is the same frame in two colours one product or two? | Launch | [O-6](CLIENT-ANSWERS.md) |
| **4** | **Confirm opening hours** — we have assumed Mon–Sat 09:00–18:00, Sunday closed, lunch 13:00–14:00. One line corrects all 27 branches | Correct bookings | [O-2](CLIENT-ANSWERS.md) |
| **5** | **Confirm the RBAC role list** — only "Super Admin" was entered, but Branch Manager questions were answered | CR-01 quote | [O-5](CLIENT-ANSWERS.md) |
| **6** | **Confirm POs are out of scope** — GRN and supplier master are both Yes, and "who approves POs" was answered "Yes" | CR-01 quote | [O-7](CLIENT-ANSWERS.md) |
| **7** | **Confirm branch reporting = revenue ranking only.** With capex and opex N/A, P&L and ROI are not computable. **This reduces your cost** | CR-01 quote | [O-8](CLIENT-ANSWERS.md) |
| **8** | **Confirm per-frame serial tracking + FIFO** is understood as scope — it is the largest single line in CR-01 | CR-01 quote | [O-11](CLIENT-ANSWERS.md) |
| 9 | Cancellation rules — hours and stage cut-off | Nothing (defaults applied) | [O-4](CLIENT-ANSWERS.md) |
| 10 | Wells Fargo station list | Pickup checkout | B1 |
| 11 | Returns / warranty wording; real testimonials; Virtual Try-On decision | Launch content | E2–E5 |
| 12 | Report digest recipients and frequency | CR-01 detail | [O-10](CLIENT-ANSWERS.md) |
| 13 | Google Maps key or branch links; DPO name; email sending domain; SMS sender ID; GA account | Launch operations | Block D, F |

**Also tell them:** the M-Pesa defect ([CODE-REVIEW C-1](CODE-REVIEW.md)) is a hard go-live blocker, it is being fixed, and it needs no decision from them. Say it rather than quietly closing it.

---

## Decisions we made so they are not left open

The client delegated A6 ("make your decision"). Recorded here and in [CLIENT-ANSWERS §2](CLIENT-ANSWERS.md) so they are reviewable rather than buried in code:

| Decision | Our call |
| --- | --- |
| Slot duration | **30 minutes** |
| Slot capacity | **1 patient per slot** |
| Daily break | **13:00–14:00** |
| Opening hours | **Mon–Sat 09:00–18:00, Sunday closed** *(inferred from "9am – 6pm")* |
| Cancellation window | **24 hours** |
| Cancellation cut-off | **Not after dispatch** |

**All six ship as admin-editable settings, not constants.** If any is wrong, Optex changes it in a minute rather than filing a change request. That is the whole point of M2.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Lens price list never arrives** | Medium | Store cannot sell its main product | Build the configurator behind the block. Escalate as commercial, not administrative — this is most of the order value |
| **Catalogue slips again** | High | No launch | Demo products unblock build and demo. Importer built against the real column shape so ingestion is same-day |
| **More defects in features marked ✅** | Medium | Unknown | 3 of 8 review findings were criticals in "done" features. CI + smoke suite is the systemic answer. Treat "marked done" as unverified until tested |
| **M2 is treated as optional polish** | Medium | Publishing false content | It contains launch blockers on *correctness*, not features. Named explicitly above so it is not cut |
| **CR-01 starts before the quote is signed** | Low | Wasted weeks | Gate needs both conditions. Requirements being unblocked is not permission to start |
| **Per-frame serial scope absorbed silently** | Medium | Underquoted CR-01 | Flagged as [O-11](CLIENT-ANSWERS.md). Price it deliberately |
| **SEO slips because it is never urgent** | Medium | Contracted deliverable unmet | It is a signed SOW obligation. It should not be the milestone that absorbs every delay |

---

## One thing worth saying plainly

The backend is genuinely strong — 78 routes, atomic checkout, both payment rails, RLS everywhere, a typed client covering the whole surface. That is why *"everything from the backend"* is achievable at all: the endpoints mostly exist and are simply unused.

But **51 features are complete and 31 of them are not backend-owned**, and **five defects sit inside features marked done** — three of them critical, in the money path. The gap on this project is not building things. It is finishing them, and verifying they work.

M1 and M2 are that. They are unblocked, and they are where the next eight weeks should go regardless of what the client sends back.
