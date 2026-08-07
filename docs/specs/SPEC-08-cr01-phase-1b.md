# SPEC-08 — CR-01 Phase 1B

**Date:** 2026-08-07 · **Status:** Requirements unblocked · **not started, pending commercial sign-off**
**Blocked on client:** Commercial agreement + 4 clarifications ([O-5, O-7, O-8, O-11](../CLIENT-ANSWERS.md))
**Source:** Client Section 5 answers · [CLIENT-ANSWERS §4](../CLIENT-ANSWERS.md)

---

> **Read this first.** The client chose **Phase 1A first, CR-01 as Phase 1B after** — the answer the input form marked "CRITICAL — ANSWER FIRST". This spec exists to make Phase 1B *quotable*, not to start it. Per [TEAM-PLAN §6](../TEAM-PLAN.md) the gate needs two conditions; Section 5 opens one, and a signed commercial agreement is the other.

---

## Problem Statement

Optex runs 27 branches on a single Super Admin login, a stock number typed into a grid, and no record of who changed what. There is no supplier data, no goods-receipt trail, no stock movement history and no cost price — so nobody can answer "what did this frame cost us", "where did this stock go", or "which branch is performing".

The Phase 1A platform sells; it does not tell Optex how the business is doing. At 27 branches with per-frame-serial inventory, the gap between "we sold it" and "we know what happened" is where margin quietly disappears.

## Goals

1. **Every stock movement is recorded** — received, transferred, adjusted, sold, counted — with a reason and an owner.
2. **Staff see only what their role permits**, and a Branch Manager sees only their branch.
3. **Optex knows its margin per product**, which requires cost price and a goods-received date.
4. **Branches can be ranked on performance** with a defensible revenue attribution rule.
5. **Every privileged action is attributable** for at least 3 months.

## Non-Goals

| Not doing | Why |
| --- | --- |
| **Purchase Orders** | Client answered **No**. Removes an entire approval workflow. |
| **Full branch P&L, ROI, break-even** | Client answered capex **N/A** and opex categories **N/A**. Without cost data these are not computable. Scope is **revenue ranking** — see [O-8](../CLIENT-ANSWERS.md). |
| Doctor consultation module | Not answered in this round. Remains blocked. |
| Accounting-system integration | Not requested. |
| Warehouse management (bin locations, pick paths) | Well beyond a 27-branch optician. |
| Demand forecasting | Needs sales history that will not exist for a year. |
| Multi-currency | Client confirmed **KES only**. |

## User Stories

### Inventory Manager

- As an Inventory Manager, I want to record goods received against a supplier, so that stock arrivals are a record rather than a memory.
- As an Inventory Manager, I want to transfer stock between branches and see it in transit, so that neither branch double-counts it.
- As an Inventory Manager, I want to adjust stock with a reason code, so that shrinkage is explained rather than absorbed.
- As an Inventory Manager, I want to run a physical count and see the variance, so that the system matches the shelf.
- As an Inventory Manager, I want to see slow-moving and aging stock, so that capital is not sitting in frames nobody wants.
- As an Inventory Manager, I want each frame tracked by serial, so that a specific unit can be traced from receipt to sale.

### Branch Manager

- As a Branch Manager, I want to see only my own branch's data, so that my screen is relevant and I cannot change another branch's stock.
- As a Branch Manager, I want to see how my branch ranks, so that I know where I stand.

### Super Admin / Accountant

- As a Super Admin, I want role-based logins, so that staff have the access their job needs and no more.
- As a Super Admin, I want 2FA on my own account, because it can change anything.
- As a Super Admin, I want an audit log covering at least 3 months, so that a disputed change has an answer.
- As an Accountant, I want margin per product, so that I know what actually makes money.
- As an Accountant, I want scheduled report digests by email, so that I do not have to log in to find out.

### Edge cases

- A serial-tracked frame is sold at a branch other than where it was received.
- A physical count finds stock the system does not have.
- A transfer is dispatched but never arrives.
- A user's role changes while they are logged in.
- Cost price changes between receipts — this is what FIFO exists to resolve.
- An online order under "customer choice" attribution where the customer chooses nothing.

## Requirements

### R1 — RBAC (foundational; build first)

Everything else reads from this. It also touches auth across all three apps, making it the **highest conflict-risk work in the programme**. One person, focused window.

| Client decision | Answer |
| --- | --- |
| Role list | **Needs confirming — [O-5](../CLIENT-ANSWERS.md)** |
| Branch Manager scoped to own branch | **Yes** |
| 2FA | **Super Admin** |
| Audit log retention | **3 months** |
| Initial user list | Later |

- [ ] Roles and permissions are data, not code — adding a role does not require a deploy
- [ ] Branch-scoped roles see and modify only their own branch, enforced **server-side**, not by hiding UI
- [ ] Super Admin requires 2FA
- [ ] Every privileged action writes to `audit_log`, retained 3 months minimum
- [ ] Given a role changes mid-session, then the new permissions apply on the next request
- [ ] Existing `super_admin` accounts migrate without interruption
- [ ] **Extends the existing `app_metadata.role` model** — the escalation fix of 2026-07-22 must not be undone. `user_metadata` remains untrusted everywhere.

> **Dependency note:** [SPEC-05 R6](SPEC-05-backend-owned-config.md) builds a settings audit trail during Phase 1A. It should be written in a shape that migrates into this `audit_log` rather than being replaced.

### R2 — Inventory ledger

The largest item. Client answers, precisely:

| Capability | Decision |
| --- | --- |
| Inter-branch transfers | **Yes** |
| Purchase Orders | **No** |
| Goods Received Notes | **Yes** |
| Adjustments with reason codes | **Yes** |
| Supplier master data | **Yes** |
| Dead-stock / aging report | **Yes** |
| Physical stock count | **Yes** |
| Valuation | **FIFO** |
| Serial tracking | **Yes — per-frame serial** |

- [ ] An append-only stock ledger records every movement with type, quantity, reason, actor and timestamp
- [ ] Current stock is **derived from the ledger**, never edited directly — this replaces today's editable grid
- [ ] GRN records goods received against a supplier, capturing **cost price** and a **received date**
- [ ] Transfers move stock between branches with an in-transit state, so neither end double-counts
- [ ] Adjustments require a reason code from a maintained list
- [ ] Physical counts produce a variance report and post an adjustment on acceptance
- [ ] FIFO valuation, so cost of goods reflects actual receipt order
- [ ] Per-frame serials are traceable receipt → transfer → sale
- [ ] Dead-stock report using days-on-shelf **from GRN date** (client-specified)
- [ ] **Phase 1A's stock decrement is refactored to write to the ledger** rather than being reimplemented

> **Scope warning:** per-frame serial tracking plus FIFO is roughly **double** SKU-level quantity tracking. Every unit becomes an individually tracked entity. Legitimate for high-value eyewear, but it must be **priced deliberately** — see [O-11](../CLIENT-ANSWERS.md).
>
> **GRN without PO** is unusual and needs confirming ([O-7](../CLIENT-ANSWERS.md)): the client answered POs No, GRN Yes, supplier master Yes, and "who approves POs — Yes", which is not a valid answer to a *who* question.

### R3 — Product analysis

| Decision | Answer |
| --- | --- |
| Cost price per SKU | **Yes — in the catalogue sheet** |
| Days-on-shelf from | **GRN date** |
| Scheduled email digests | **Yes** — recipients and frequency unknown ([O-10](../CLIENT-ANSWERS.md)) |
| Report required | **Margin** |

- [ ] `products.cost_price` column added — **it does not exist today**, so margin analysis currently has nowhere to read from
- [ ] Margin per product and per category, from real cost price
- [ ] Days-on-shelf computed from GRN date, per R2
- [ ] Scheduled digests using the existing Resend integration and cron module
- [ ] Given no cost price, then margin reports say so explicitly rather than showing a misleading 100%

> **Dependency:** margin needs **both** the ledger (R2) **and** the real catalogue ([O-6](../CLIENT-ANSWERS.md)). Demo products have no meaningful cost price. This is the last item to become truly useful.

### R4 — Branch revenue ranking

**Scope reduced by the client's own answers**, in their favour.

| Decision | Answer |
| --- | --- |
| Branch capex | **N/A** |
| Monthly opex categories | **N/A** |
| Who enters opex | Admin |
| Online revenue attribution | **Customer choice** |
| Reports required | **Ranking** |

- [ ] Revenue is attributed per branch; online orders attribute to the branch the customer chose
- [ ] Given the customer chose nothing, then a documented fallback applies and is visible in the report
- [ ] Branch ranking by revenue over a selectable period
- [ ] Optional opex capture, so P&L becomes possible later without a rewrite

> With capex and opex both N/A there is **no profit, no ROI and no break-even** — only revenue. What is deliverable is a **branch revenue ranking**, which is far smaller than "Branch Investment vs Revenue" implies. Confirm with the client ([O-8](../CLIENT-ANSWERS.md)) — this reduces their cost.

### R5 — Doctor consultation module

**Not answered in this round. Remains fully blocked.** Listed for completeness. [SPEC-04 R7](SPEC-04-appointment-scheduling.md)'s exclusion model is deliberately general enough to represent per-doctor availability without redesign — that is the only Phase 1A investment being made toward it.

## Success Metrics

**Leading (60 days after Phase 1B launch):**

| Metric | Success | Method |
| --- | --- | --- |
| Stock movements recorded through the ledger | 100% | No direct stock edits remain possible |
| Branches performing a physical count in the first cycle | 27 of 27 | Count records |
| Stock variance at first count | Baseline established | Variance report |
| Users on a role other than Super Admin | > 80% of staff | User admin |
| Privileged actions with an audit entry | 100% | Audit log |

**Lagging (first two quarters):**

| Metric | Target | Method |
| --- | --- | --- |
| Stock variance at count | Declining cycle on cycle | Variance trend |
| Dead stock identified and cleared | First cohort actioned | Aging report |
| Margin visibility | 100% of SKUs with cost price | Product report |
| Time to answer "where did this frame go" | < 2 minutes | Serial trace |
| Shrinkage as a share of stock value | Measurable, then declining | Ledger vs. count |

## Open Questions

**Blocking — must resolve before quoting.**

| # | Question | Ref |
| --- | --- | --- |
| Q1 | **Confirm the full role list.** Only "Super Admin" was entered, yet Branch Manager questions were answered. RBAC is foundational; the wrong role set is expensive to unwind | [O-5](../CLIENT-ANSWERS.md) |
| Q2 | **Confirm POs are genuinely out of scope**, given GRN and supplier master are both Yes and "who approves POs" was answered "Yes" | [O-7](../CLIENT-ANSWERS.md) |
| Q3 | **Confirm branch reporting is revenue ranking only**, with P&L deferred until cost data exists | [O-8](../CLIENT-ANSWERS.md) |
| Q4 | **Confirm per-frame serial tracking with FIFO is understood as scope.** This is the largest single line in CR-01 | [O-11](../CLIENT-ANSWERS.md) |

**Non-blocking.**

| # | Question | Ref |
| --- | --- | --- |
| Q5 | Report digest recipients and frequency | [O-10](../CLIENT-ANSWERS.md) |
| Q6 | Initial user list with roles and branches | Client — needed before launch, not before build |
| Q7 | Stock adjustment reason codes — Optex's own list | Client |
| Q8 | Attribution fallback when an online customer chooses no branch | Product |
| Q9 | Is 3-month audit retention sufficient given prescription data is health data under DPA 2019? | Legal — **worth raising**; 3 months is short for health-adjacent records |

## Timeline Considerations

**This spec is for quoting, not scheduling.** Do not start until both gate conditions are met: Section 5 answered ✅, and a signed commercial agreement ❌.

**Build order is not negotiable:** **R1 (RBAC) → R2 (ledger) → R3 (analysis) / R4 (ranking).** Inventory, analysis and reporting all read from RBAC's branch scoping. R3 depends on R2's GRN data. R4 is parallel-safe once R1 lands.

**Relative sizing** (for the estimate, not a commitment):

| Item | Relative size | Driver |
| --- | --- | --- |
| R2 Inventory ledger | **Largest** | Per-frame serial + FIFO + 6 sub-modules |
| R1 RBAC | Large | Touches auth in all three apps; highest conflict risk |
| R3 Product analysis | Medium | Depends on R2 and the real catalogue |
| R4 Branch ranking | **Small** | Reduced by capex/opex being N/A |
| R5 Doctor module | Unknown | Not specified |

**Phase 1A dependencies to protect** — these cost little now and save a rewrite later:

1. Stock decrement behind a **single function** ([SPEC-02](SPEC-02-checkout-fulfilment.md)) so R2 wraps it rather than hunting call sites.
2. Settings audit in a shape that migrates into `audit_log` ([SPEC-05 R6](SPEC-05-backend-owned-config.md)).
3. A general appointment exclusion model ([SPEC-04 R7](SPEC-04-appointment-scheduling.md)) for future per-doctor availability.
4. `products.cost_price` added during catalogue import, not retrofitted across a live catalogue.

**Honest note on the estimate:** the original CR-01 assessment put Phase 1 at 12–14 weeks combined. Two answers move that in opposite directions — dropping POs and reducing branch P&L to revenue ranking **shrinks** it; per-frame serial tracking with FIFO **grows** it, and by more. Expect the inventory ledger to dominate the quote.
