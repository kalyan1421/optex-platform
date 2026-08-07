# SPEC-02 — Checkout & Fulfilment

**Date:** 2026-08-07 · **Status:** Partially blocked on client · **Owner:** Intern C (checkout, stock) + Intern B (station data, geo rules)
**Blocked on client:** **Partially resolved 2026-08-07** — see [CLIENT-ANSWERS.md](../CLIENT-ANSWERS.md).

> **Answers received:** currency is **KES only** · out-of-stock shows **greyed out "Out of stock"** (H1) · **single central stock pool** (H2) · **KES 300 flat delivery confirmed, and must be admin-editable** (H4) · **account required** — no guest checkout (B4) · **COD removed** (E6).
>
> **Still blocking:** the **free-delivery threshold** ([O-1](../CLIENT-ANSWERS.md)) — the client answered "39", but with KES as the currency that is KES 39, less than a seventh of the delivery charge they confirmed in the same message. The intended figure is likely ~KES 5,000 (≈$39), but a revenue-affecting number will not be guessed. The **Wells Fargo station list** (B1) is also still outstanding.

**Phase 1 below is unblocked and should start now.**
**Source:** [ROADMAP §A.3 C-3](../ROADMAP.md), [CODE-REVIEW H-1, M-2, M-3](../CODE-REVIEW.md), [FEATURE-STATUS §2](../FEATURE-STATUS.md)

---

## Problem Statement

Checkout was built for a model the client does not operate. It collects a street address and charges a flat KES 300, while the client's actual fulfilment is **store pickup plus third-party Wells Fargo pickup stations, free above a threshold within Nairobi**. Separately, the ordering system has **no connection to stock at all** — a customer can order 1,000 units of an item Optex holds one of, and nothing objects.

Every online order therefore risks one of two failures: a customer who cannot receive their order the way it was sold to them, or an order Optex cannot fulfil because the frames do not exist. Both surface after the money is taken, and the client's stated policy is "no refunds" — so both land as a customer-service problem with no clean resolution.

## Goals

1. **A customer can choose how they receive their order** — branch pickup or a named Wells Fargo station — and see the correct charge before paying. Measured by: checkout completion rate holds or improves after the change.
2. **Delivery charges are computed from a rule, not a constant**, and the rule is editable without a code deploy.
3. **No order is accepted for stock Optex does not have** (subject to the client's answer on H1–H3).
4. **The customer knows an item is unavailable before they add it to the cart**, not after they pay.
5. **VAT and shipping arithmetic exist in exactly one place.** Today they are duplicated across TypeScript and SQL and kept in sync by a comment.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Full inventory ledger (movements, GRN, transfers, valuation) | CR-01, unquoted, blocked on Section 5. This spec needs a *stock check*, not a ledger. |
| Per-branch stock allocation for online orders | The client holds stock centrally ([ROADMAP A.1](../ROADMAP.md)). One pool until they say otherwise. |
| Live Wells Fargo API integration | No evidence one is available or needed. Stations are reference data the admin maintains. |
| Courier tracking numbers / handover scans | Not in the SOW. Order tracking already has 6 stages. |
| Returns / refund flows | Client policy is "no refunds". The policy page states it; there is no flow to build. |
| Lens and coating configurator | Genuinely blocked — the client gave "from $28 / from $20" and no price matrix ([C1–C3](../CLIENT-QUESTIONS.md)). Separate spec when the list arrives. |
| Guest checkout | Real gap, but a distinct decision ([B4](../CLIENT-QUESTIONS.md)) with auth implications. Parked deliberately. |

## User Stories

### Customer

- As a Nairobi customer, I want to choose a Wells Fargo station near me instead of giving a street address, so that I collect my glasses somewhere convenient and secure.
- As a customer, I want to see the delivery charge before I pay, so that the total is not a surprise at the payment step.
- As a customer spending above the free-delivery threshold, I want to see that delivery is free, so that I understand the benefit of the larger order.
- As a customer outside Nairobi, I want to see honestly whether Optex delivers to me and at what cost, rather than completing checkout and finding out later.
- As a customer, I want an out-of-stock frame to be clearly marked before I add it to my cart, so that I do not build an order that cannot be fulfilled.
- As a customer collecting from a branch, I want to know which branch and during what hours, so that I do not travel to a closed store.

### Optex operations

- As a branch manager, I want an order to name its collection point unambiguously, so that I know whether to hold it or hand it to Wells Fargo.
- As an Optex admin, I want to add, rename or disable a pickup station without a developer, so that the list matches the courier's reality.
- As an Optex admin, I want to change the free-delivery threshold when the commercial terms change, without a code deploy.

### Edge cases

- A station is disabled while a customer has it selected in an in-progress cart.
- Cart contents change after the free-delivery threshold was met, dropping it below.
- Stock runs out between add-to-cart and checkout.
- Stock runs out between checkout and picking (the H3 question).
- A customer with an existing saved address checks out after the model changes.

## Requirements

### Phase 1 — P0, unblocked, start now

**R1. Single source of truth for money arithmetic.**
VAT rate and shipping are currently duplicated between `cart.service.ts` and the `place_order` SQL function, synchronised by a comment instructing maintainers to keep them "EXACTLY" aligned.

- [ ] VAT rate is defined once and read by both the cart preview and order placement
- [ ] Given the VAT rate changes, when one value is updated, then cart preview and final order total both change consistently
- [ ] A test asserts cart-preview total equals placed-order total for the same cart

**R2. Stock is visible and blocks checkout.**
The read-only half of the stock problem is not blocked on the client — showing truth is never the wrong answer.

- [ ] Product detail page shows availability state derived from `inventory`
- [ ] Given an item at zero stock, when the customer attempts to add it, then they are told it is unavailable
- [ ] Given stock became insufficient between add-to-cart and checkout, when checkout is submitted, then it is rejected naming the affected line
- [ ] The check happens **inside** `place_order`'s transaction, not before it — a check outside is the same race the appointment booking has ([CODE-REVIEW H-2](../CODE-REVIEW.md))

**R3. Reject COD server-side.** *(Shared with [SPEC-01 R6](SPEC-01-payment-integrity.md); implement once.)*

**R4. Delivery options are data, not constants.**
Even before the station list arrives, replace the hardcoded `300` with a configurable rule structure.

- [ ] Delivery methods, zones and thresholds are stored in the database, not in code
- [ ] Given no rules are configured, then the system falls back to a single explicit default rather than a magic number
- [ ] Admin can edit rules; changes take effect without a deploy

### Phase 2 — P0, blocked on client (B1–B3, H1–H3)

**R5. Pickup-station selection replaces the address form.**

- [ ] Customer chooses: collect at an Optex branch, or a Wells Fargo station
- [ ] Branch pickup shows the branch's address and opening hours
- [ ] Station selection is searchable — 27 branches plus an unknown number of stations is too many for a plain dropdown
- [ ] Given a disabled station in an in-progress cart, when the customer reaches checkout, then they are prompted to reselect
- [ ] The chosen collection point is stored on the order and shown on the confirmation, the tracking page, and in the admin order detail

**R6. Geo-scoped delivery charging.**

- [ ] Free above the client-confirmed threshold, for qualifying stations only
- [ ] Below threshold, or outside the free zone, the configured charge applies
- [ ] Given the cart drops below the threshold after an item is removed, when the cart is re-rendered, then the delivery charge reappears and the total updates
- [ ] The charge shown in the cart equals the charge placed on the order — verified by test, not by comment

**R7. Out-of-stock behaviour matches the client's answer to H1–H3.**
Deliberately unspecified pending their decision. The three plausible answers — hide, show-unavailable, accept-and-backorder — imply materially different builds; specifying one now would be guessing.

### P1 — Should have

- **R8.** Saved collection preference on the customer profile, so repeat customers do not reselect each time. *(`shipping_address` is currently stored per order, not per customer.)*
- **R9.** Low-stock threshold surfaced in the admin product grid, so Optex sees a problem before customers do.
- **R10.** Invoice / receipt download ([FEATURE-STATUS §2](../FEATURE-STATUS.md) lists this absent). Note this is also the natural insertion point for eTIMS (CR-02) — design the document generation so the KRA fields can be added, without building them.

### P2 — Future considerations

- Per-branch stock allocation, if the client moves off central stock.
- Stock reservation with a TTL during checkout — only worth it at contention levels Optex will not see for a long time.
- Inventory ledger integration (CR-01). **R2 must write its stock decrement through a single function**, so the ledger can later wrap that function rather than requiring every call site to be found again.

## Success Metrics

**Leading (first 30 days post-launch):**

| Metric | Success | Stretch | Method |
| --- | --- | --- | --- |
| Checkout completion rate (cart → paid) | Holds at pre-change level | +10% | Order funnel |
| Orders rejected at checkout for insufficient stock | < 2% of attempts | < 0.5% | API logs |
| Orders placed for stock that did not exist | **0** | 0 | Reconciliation |
| Customers reselecting a collection point after error | < 5% | < 2% | Checkout events |

**Lagging (first quarter):**

| Metric | Target | Method |
| --- | --- | --- |
| Orders cancelled post-payment for unavailable stock | 0 | Admin order status |
| Delivery-charge disputes | < 1% of orders | Support log |
| Uncollected orders at stations | < 3% | Admin fulfilment report |

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Full Wells Fargo station list — name and location | Client ([B1](../CLIENT-QUESTIONS.md)) | **Yes** for R5 |
| Q2 | Free-delivery threshold in KES, and which stations qualify | Client ([B2](../CLIENT-QUESTIONS.md), depends on the currency answer [A1](../CLIENT-QUESTIONS.md)) | **Yes** for R6 |
| Q3 | Charge below threshold, and outside Nairobi | Client ([B3](../CLIENT-QUESTIONS.md)) | **Yes** for R6 |
| Q4 | Out-of-stock behaviour: hide / show unavailable / backorder | Client ([H1](../CLIENT-QUESTIONS.md)) | **Yes** for R7, not for R2 |
| Q5 | Which stock pool gates an online order, given monthly reconciliation | Client ([H2](../CLIENT-QUESTIONS.md)) | No — assume central pool |
| Q6 | What happens if stock runs out between order and picking | Client ([H3](../CLIENT-QUESTIONS.md)) | No — needed before launch, not before build |
| Q7 | Is stock accurate enough to block on, given monthly reconciliation? If it is routinely wrong, a hard block creates false rejections | Engineering + Client | No — R2 is correct either way; only the strictness setting changes |
| Q8 | Does branch pickup imply the order is fulfilled from that branch's stock? | Client | No — assume central until Q5 |

## Timeline Considerations

**Phase 1 (R1–R4) is unblocked** and should not wait for the client. It is roughly one sprint and de-risks Phase 2 by putting the configuration structure in place before the data arrives.

**Phase 2 (R5–R7) cannot start until Q1–Q4 return.** Per [CLIENT-QUESTIONS](../CLIENT-QUESTIONS.md) these are in Block B, which is *not* the blocking Block A — meaning they may well arrive late. Plan for that: Phase 1 leaves the system in a shippable state.

**Dependency on SPEC-01:** R3 is shared. Do not implement twice.

**Dependency on CR-01:** none, and R2's P2 note is what keeps it that way. If the stock decrement is scattered across call sites, the future ledger work becomes an archaeology exercise.

**Estimate:** Phase 1 — 1 sprint. Phase 2 — 2 sprints from the date the client answers.
