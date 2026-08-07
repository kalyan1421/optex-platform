# OPTEX — Client Answers & Decision Log

**Date received:** 2026-08-07 · **Source:** Client response to [CLIENT-QUESTIONS.md](CLIENT-QUESTIONS.md)
**Status:** Section 5 (CR-01) answered — **the CR-01 gate is now open on requirements.** Commercial sign-off still outstanding.

This is the authoritative record of what was decided. Where an answer conflicts with another answer or with the code, that is stated plainly rather than resolved silently.

---

## 1. Answered and actionable

### Commercial & currency

| Ref | Question | Answer | What it changes |
| --- | --- | --- | --- |
| **A1** | Transaction currency | **KES only** | ✅ **Resolves the single biggest structural risk.** M-Pesa settles in KES; every schema column is `*_kes`. No FX layer, no display conversion. [ROADMAP C-1](ROADMAP.md) closed. |
| **A4** | Which spreadsheet is authoritative | **`Business model.xlsx`** | ✅ Confirms the version all planning was built on. [ROADMAP C-4](ROADMAP.md) closed. |
| **E6** | Cash on Delivery | **Remove** | Remove from checkout **and** reject at the API — `place_order` still routes `'cod'` to a fulfillable unpaid order ([CODE-REVIEW M-3](CODE-REVIEW.md)). |
| **E7** | Discounts / promotions at launch | **None** | Hide the promotions UI; keep the engine. Also lowers the urgency of the `increment_promo_uses` privilege fix — but do not skip it. |
| **H4** | Is KES 300 flat delivery the real charge | **Yes — and make it editable from the admin panel** | Confirms the current figure and mandates it becomes configuration, not a constant. |

### Catalogue

| Ref | Question | Answer | What it changes |
| --- | --- | --- | --- |
| **A2** | Product catalogue | **Use demo products for now** | Unblocks build and demo. **Does not unblock launch** — see [§3 O-6](#3-still-open). The importer should still be built against the real column shape so ingestion is same-day when the catalogue arrives. |

### Commerce rules

| Ref | Question | Answer | What it changes |
| --- | --- | --- | --- |
| **B4** | Guest checkout | **Account required for orders *and* appointments** | ✅ Simplifies checkout. **But note:** appointments currently *do* support guests (`contact_name` / `contact_phone` columns). That path must now be closed. |
| **B5** | Customer order cancellation | **Yes — customer requests, admin confirms.** Time- and stage-based rules | New feature. Not a simple status flip — it is a request/approval workflow. See [SPEC-06](specs/SPEC-06-order-lifecycle.md). Exact rules still open ([O-4](#3-still-open)). |
| **H1** | Out-of-stock behaviour | **Show greyed out as "Out of stock"** | ✅ Decided. Product stays visible and indexable; add-to-cart is blocked. Good for SEO — the page keeps its ranking. |
| **H2** | Which stock pool gates an online order | **A single central pool** | ✅ Confirms no per-branch allocation. Substantially simplifies the stock check. |
| **H5** | Payment reversed after dispatch | **Admin updates manually** | ✅ No automation needed. Surface reversed transactions in the admin Payments screen so they cannot be missed. |

### Appointments

| Ref | Question | Answer | What it changes |
| --- | --- | --- | --- |
| **A5** | Branch opening hours | **All 27 branches share the same pattern** | Helpful — one configuration covers all. **But the pattern itself was not supplied.** See [O-2](#3-still-open). |
| **A6** | Slot duration / capacity / breaks | **"Make your decision"** | Delegated to us. Our decision is recorded in [§2](#2-decisions-we-made-on-the-clients-behalf). |

---

## 2. Decisions we made on the client's behalf

The client delegated A6. Recording these explicitly so they are reviewable rather than buried in code.

| Decision | Our call | Rationale |
| --- | --- | --- |
| **Slot duration** | **30 minutes** | Matches the current implementation, and is the standard length for a routine refraction. 15 min risks rushing; 60 min halves daily capacity. |
| **Slot capacity** | **1 patient per slot per branch** | Conservative default. A double-booked slot is a visible failure in the waiting room; an under-booked one is not. |
| **Daily break** | **13:00–14:00, closed** | Standard Kenyan retail lunch hour. Better to block it and be asked to remove it than to book patients into an unattended branch. |
| **Opening hours** | **Mon–Sat 09:00–18:00, Sunday closed** | Derived from the "9am – 6pm" on the input form plus the six-day retail norm. **This is an inference, not an answer** — see [O-2](#3-still-open). |

**Every one of these ships as admin-editable configuration, not a constant.** That is the point of the client's "everything from the backend" instruction — if our inference is wrong, they change it themselves in a minute rather than filing a change request.

---

## 3. Still open

Ordered by how much they block.

### O-1 — BLOCKING: the free-delivery threshold is not a usable number

> **Client answer:** "all order free order above 39"

Two problems:

1. **The currency is now KES.** KES 39 is roughly USD 0.30 — less than a seventh of the KES 300 delivery charge the same message confirms. Every order would ship free. The original form said "**$**39", so the intended figure is almost certainly **~KES 5,000**, but we will not guess a revenue-affecting number.
2. **The geographic scope appears to have widened.** The form said free above $39 *within Nairobi, at Wells Fargo stations*. This answer says "all orders". If free delivery now applies countrywide, that is a materially different cost structure.

**Question:** what is the free-delivery threshold **in KES**, and does it apply countrywide or only within Nairobi?

**Blocks:** shipping rules, cart totals, checkout ([SPEC-02](specs/SPEC-02-checkout-fulfilment.md) Phase 2).

### O-2 — Opening hours: the pattern was confirmed, but not supplied

"All 27 branches share the same pattern" is genuinely useful, but the pattern is still just "9am – 6pm" with no weekday breakdown.

**Question:** confirm **Mon–Sat 09:00–18:00, Sunday closed, lunch 13:00–14:00** — or correct it. One line covers all 27 branches.

**Blocks:** nothing, because we are shipping our inference as editable configuration. But if it is wrong, 27 branches take wrong bookings until it is corrected.

### O-3 — Lens and coating price list

> **Client answer:** "we need every option and its price: single vision, bifocal, progressive"

We read this as *restating the requirement*, not supplying the data. We still have only "from $28" and "from $20" — and those were dollar figures, now superseded by the KES decision.

**Question:** the full price list in KES — every lens type and every coating, each with its price, and whether coatings are added on top of the lens price or sold as bundles.

**Blocks:** the entire lens configurator ([SPEC-07](specs/SPEC-07-lens-configurator.md)). This is a core optician feature and currently the storefront sells frames only.

### O-4 — Cancellation rules

> **Client answer:** "customer cancel their own order but that will be status need to confirmable in admin side with hour and stages wise"

The workflow is clear — customer requests, admin approves. The thresholds are not.

**Question:** (a) up to how many hours after placing an order can a customer request cancellation? (b) beyond which fulfilment stage is cancellation refused entirely — after payment, after picking, or after dispatch? Given "no refunds", (c) what happens to a cancellation request for an order already paid?

**Blocks:** [SPEC-06](specs/SPEC-06-order-lifecycle.md) acceptance criteria. We will build the workflow with the thresholds as configuration and default them, so this does not block the build.

### O-5 — RBAC role list is internally inconsistent

The role list was answered "**Super Admin**" — but the very next answer confirms "**Branch Manager sees own branch only? Yes**", and 2FA is scoped to "Super Admin", implying other roles exist without it.

**Question:** confirm the full list. Our reading is that all seven were intended (Super Admin, Branch Manager, Branch Staff, Inventory Manager, Accountant, Marketing, Doctor) and only the first was typed into the cell. **RBAC is the foundation of CR-01** — inventory, doctor and analytics all read from it — so building the wrong role set is expensive to unwind.

**Blocks:** CR-01 Phase 1B start ([SPEC-08](specs/SPEC-08-cr01-phase-1b.md)).

### O-6 — Real product catalogue

"Demo products for now" unblocks the build and any demo. It does not unblock launch. Nothing ships to real customers without real SKUs, prices, cost prices and photography.

**Also unresolved from the original list:** A3 (is the same frame in multiple colours one product or several?) and E1 (product photography). A3 in particular determines the data model — changing it later means re-importing the whole catalogue.

### O-7 — Inventory answers contain a contradiction

| Answer given | Problem |
| --- | --- |
| Purchase Orders: **No** | but "Who approves POs" answered **"Yes"** — not a valid response to a question asking *who* |
| Goods Received Notes: **Yes** | GRN without PO is workable (receive directly against a supplier) but unusual — GRN normally reconciles *against* a PO |
| Supplier master data: **Yes** | consistent with GRN, inconsistent with dropping POs |
| Days-on-shelf counted from **GRN date** | requires GRN to be in place before any product-age reporting works — this makes GRN a dependency of the margin reports, not an optional extra |

**Question:** confirm POs are genuinely out of scope. If yes, GRN becomes a standalone goods-receipt record against a supplier, and "who approves POs" falls away.

### O-8 — Branch P&L has no cost data

Branch capex and monthly opex categories both came back **N/A**, but reports are wanted (**Ranking**).

Without capex or opex there is no profit, no ROI and no break-even — only **revenue**. What is deliverable is a **branch revenue ranking**, which is a much smaller piece of work than "Branch Investment vs Revenue" implies.

**Question:** confirm that branch reporting at launch means **revenue ranking only**, with P&L deferred until cost data exists. This materially reduces CR-01 Item 3 scope — in the client's favour.

### O-9 — Margin reporting needs cost price, which needs the catalogue

Cost price is confirmed "Yes — in the Product Catalogue sheet", and the requested report is **Margin**. But the catalogue is the item that came back empty and is now "demo products for now".

`products.cost_price` **does not exist as a column today** ([FEATURE-STATUS §10](FEATURE-STATUS.md)). Margin analysis has nowhere to read from. The column is cheap to add; the data is what is missing.

### O-10 — Scheduled report digests: recipients and frequency

"Yes" to scheduled email digests, but not to whom or how often.

**Question:** which reports, to which email addresses, at what frequency (daily / weekly / monthly)?

### O-11 — Serial tracking is a significant scope item, quietly agreed

"Batch / serial tracking: **Yes — per-frame serial**" combined with "**FIFO**" valuation is the single largest line in CR-01 Item 1. Per-frame serial tracking means every physical frame is an individually tracked entity through receipt, transfer, sale and return — not a SKU-level quantity.

This is legitimate for high-value eyewear, but it roughly doubles the inventory model's complexity versus SKU-level tracking. **Flagging it explicitly so it is priced deliberately, not absorbed.**

---

## 4. The delivery-model decision, and what it means

> **Client answer:** Preferred delivery model — **Launch** (Phase 1A first, CR-01 as Phase 1B after)

This is the answer the form marked "CRITICAL — ANSWER FIRST", and it is the right one. It means:

- **Phase 1A ships first and alone.** Storefront, checkout, payments, appointments, admin panel, SEO.
- **CR-01 does not start now.** Requirements are unblocked; commercial sign-off is not. Per [TEAM-PLAN §6](TEAM-PLAN.md), the gate needs *both*.
- **Nothing in Phase 1A should be designed around CR-01** — but the extension points identified in the specs (stock decrement behind a single function, the appointment exclusion model, admin action logging) should be respected, because those are what make Phase 1B additive rather than a rewrite.

**What this changes about the CR-01 gate:** it was shut on two counts. One is now open. The remaining condition is a signed commercial agreement, which needs a scope and estimate — and Section 5's answers, plus O-5, O-7, O-8, O-11 above, are exactly what that estimate is built from. See [SPEC-08](specs/SPEC-08-cr01-phase-1b.md).

---

## 5. Summary — what moved

| Before | After |
| --- | --- |
| Currency structurally unresolved (KES vs USD) | ✅ **KES** — the biggest risk on the project is closed |
| CR-01 unplannable, Section 5 blank | ✅ Requirements answered; scope estimable; 4 clarifications outstanding |
| Phase split unknown | ✅ **Phase 1A first**, CR-01 after |
| Guest checkout undecided | ✅ Account required |
| Out-of-stock behaviour unknown | ✅ Greyed out, stays visible |
| Stock model unknown | ✅ Single central pool |
| Delivery charge unconfirmed | ✅ KES 300, admin-editable |
| Appointment rules blank | ✅ Delegated to us; decided and recorded |
| **Free-delivery threshold** | 🔴 **Now worse** — "39" with no currency is unusable ([O-1](#o-1--blocking-the-free-delivery-threshold-is-not-a-usable-number)) |
| Lens pricing | 🔴 Still absent |
| Real catalogue | 🟡 Deferred, not resolved |

**One number blocks checkout: O-1.** Everything else has either an answer or a safe default.
