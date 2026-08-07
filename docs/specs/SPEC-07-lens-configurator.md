# SPEC-07 — Lens & Coating Configurator

**Date:** 2026-08-07 · **Status:** Blocked on the price list · **Owner:** Intern A
**Blocked on client:** **Yes — [O-3](../CLIENT-ANSWERS.md).** The model can be built; nothing can be sold without prices.
**Source:** Client — *"we need every option and its price: single vision, bifocal, progressive"* · [FEATURE-INVENTORY P-11](../FEATURE-INVENTORY.md)

---

## Problem Statement

Optex is an optician, and the storefront sells frames. A customer buying prescription glasses must choose a lens type and coatings — that is the majority of the value and, at "from $28" lenses plus "from $20" coatings against frames in the same range, likely **the majority of the order value**.

Today the product page carries a single hardcoded display string about lens options at `product/[slug]/page.jsx:589`. There is no lens model, no coating model, no price for either, and no way to add them to a cart. A customer can buy an empty frame and nothing else. The `order_items.lens_option` column exists and is written from the cart, but nothing prices it.

Every prescription sale therefore has to be completed by phone or in branch — which means the online store cannot complete the transaction it exists to complete.

## Goals

1. **A customer can buy a complete pair of glasses online** — frame, lens type and coatings — in one flow.
2. **The price updates as they choose**, so there is no surprise at checkout.
3. **Optex sets every lens and coating price from the admin panel**, per [SPEC-05](SPEC-05-backend-owned-config.md).
4. **The order tells the branch exactly what to make** — frame, lens, coatings, and the prescription it belongs to.
5. **Average order value rises**, because the order finally contains what the customer actually needs.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Prescription value entry (SPH / CYL / axis) at checkout | Prescription **upload** already exists and works. Typing clinical values into a web form is an error class Optex does not need — the uploaded prescription is the source of truth. |
| Lens thickness / index selection | Not mentioned by the client. Add when they ask; the model below accommodates it. |
| Automatic lens recommendation from an uploaded prescription | Requires OCR of clinical documents. Real value, wrong sequencing. |
| Frame-specific lens compatibility rules | No data on which frames accept which lenses. Assume all combinations valid until told otherwise ([Q3](#open-questions)). |
| Contact lenses | Different product model entirely. |
| Lens-only purchase (no frame) | Not requested. The model should not preclude it. |

## User Stories

### Customer

- As a customer needing prescription glasses, I want to choose my lens type on the product page, so that I buy a complete pair rather than an empty frame.
- As a customer, I want to see the total update as I add a coating, so that I understand what each option costs.
- As a customer, I want each option explained in plain language, so that I can choose between bifocal and progressive without calling.
- As a customer, I want to attach my prescription to the order, so that Optex can make the lenses without chasing me.
- As a customer buying non-prescription sunglasses, I want to skip the lens step entirely.

### Optex

- As an Optex admin, I want to set the price of every lens type and coating, so that I can change prices without a developer.
- As an Optex admin, I want to disable an option when a supplier stops carrying it, without deleting its history.
- As branch staff, I want the order to state exactly which lens and which coatings, so that I can make the correct pair.

### Edge cases

- Customer selects a coating incompatible with their lens type.
- A price changes while the item sits in a cart.
- A prescription lens is ordered with no prescription uploaded.
- An option is disabled while it is in someone's cart.
- Sunglasses or accessories where no lens choice applies.

## Requirements

### P0 — Must have

**R1. Lens and coating catalogue.**
Backend-owned reference data, not code.

- [ ] Lens types are stored with a name, plain-language description, price and active flag
- [ ] Coatings are stored the same way
- [ ] Admin can create, edit, reprice, and deactivate — never hard-delete, because orders reference them
- [ ] A deactivated option disappears from the storefront but remains readable on historical orders
- [ ] Client's named lens types are supported: **single vision, bifocal, progressive**, plus any others they supply

**R2. A price model that survives the client's answer.**
The client has not yet said whether coatings are added to the lens price or sold as bundles ([O-3](../CLIENT-ANSWERS.md)). Both are common.

- [ ] Line price = frame + lens + sum of selected coatings, computed **server-side**
- [ ] The model supports bundled pricing without a schema rewrite — a bundle is a lens option with a price that already includes its coatings
- [ ] **Prices are never computed in the browser.** The cart displays what the API returns. This is the exact defect already present in promo discounts (`cart/page.jsx:62-89`) and it must not be repeated.

**R3. Product-page selection.**

- [ ] Prescription-eligible products show lens selection; others do not
- [ ] Coatings are selectable once a lens type is chosen
- [ ] The displayed price updates on each change, from a server-computed figure
- [ ] Given no lens is selected on a prescription product, when the customer adds to cart, then they are prompted rather than silently sold a bare frame
- [ ] Each option carries its plain-language explanation inline
- [ ] Selection state survives a page refresh
- [ ] **Replaces the hardcoded string at `product/[slug]/page.jsx:589`**

**R4. Configuration flows through cart and order.**

- [ ] Cart lines show frame, lens and coatings with their individual prices
- [ ] The customer can change the configuration from the cart without re-adding the item
- [ ] `place_order` prices the configuration server-side and snapshots it onto `order_items`
- [ ] Given a price changes between add-to-cart and checkout, then the **cart is repriced and the change is shown before payment** — never silently applied
- [ ] Order confirmation, tracking, admin order detail and any invoice all show the full configuration

**R5. Prescription linkage.**

- [ ] A prescription-lens order prompts the customer to upload or select a prescription
- [ ] Given none is attached, when the order is placed, then it is flagged in admin as awaiting a prescription — **do not block the sale**; Optex can chase, and blocking loses the order
- [ ] Admin order detail links straight to the prescription file, using the existing ownership-checked signed-URL path

**R6. Which products are prescription-eligible is data, not a guess.**

- [ ] A product-level flag marks eyewear that takes prescription lenses
- [ ] Sunglasses, accessories and readers behave correctly without a lens step
- [ ] Defaults are set sensibly at catalogue import rather than requiring 500 manual edits

### P1 — Should have

- **R7.** Lens comparison — a short side-by-side of single vision, bifocal and progressive. This is the decision customers most often phone about.
- **R8.** Lens and coating attach rate in admin analytics — directly measures whether this feature is working.
- **R9.** Frame-plus-lens bundle promotions, once the client wants promotions ([E7](../CLIENT-ANSWERS.md): none at launch).

### P2 — Future considerations

- Lens index / thickness options.
- Compatibility rules between frames and lenses.
- Prescription-driven recommendations.
- Lens-only reorder for existing customers — high-margin and repeatable.

## Success Metrics

**Leading (30 days after the price list lands):**

| Metric | Success | Stretch | Method |
| --- | --- | --- | --- |
| Prescription orders including a lens selection | > 90% | > 98% | Order data |
| Coating attach rate | > 40% | > 60% | Order data |
| Configurator abandonment | < 15% | < 8% | Funnel events |
| Cart price ≠ order price | **0** | 0 | Automated test |
| Orders flagged "awaiting prescription" | < 20% | < 10% | Admin queue |

**Lagging (first quarter):**

| Metric | Target | Method |
| --- | --- | --- |
| Average order value vs. frame-only baseline | **+60%** | Order analytics |
| Prescription sales completed online without a phone call | > 70% | Support log |
| Lens-related support contacts | < 10% of orders | Support log |
| Margin per order | Baseline established | Needs `cost_price` — [O-9](../CLIENT-ANSWERS.md) |

**The AOV figure is the point of this spec.** If lenses and coatings are comparable in price to frames, completing the pair online should roughly double order value. That is the business case, and it is why this should not sit behind lower-value work once the prices arrive.

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | **Full lens price list in KES** — every type, every price | Client ([O-3](../CLIENT-ANSWERS.md)) | **Yes — hard block on launch of this feature** |
| Q2 | **Full coating price list in KES** — anti-glare, blue-cut, photochromic, others | Client ([O-3](../CLIENT-ANSWERS.md)) | **Yes** |
| Q3 | Are coatings added on top of the lens price, or sold as bundles? | Client ([O-3](../CLIENT-ANSWERS.md)) | **Yes** for pricing; R2 keeps both open |
| Q4 | Are all coatings valid on all lens types? | Client | No — assume yes; model allows restriction later |
| Q5 | Should a customer be able to buy a frame with no lens? | Client | No — assume yes (frame replacement is a real use case) |
| Q6 | Do lens prices vary by frame, or are they flat? | Client | No — assume flat, which the model supports |
| Q7 | Is there a fitting or dispensing fee? | Client | No — assume no |

## Timeline Considerations

**Hard-blocked on Q1–Q3.** R1's data model and R6's flag can be built against demo prices; nothing can go live without real ones.

**Recommended approach — build behind the block.** R1, R2, R3 and R6 are all buildable against placeholder prices. When the list arrives it is a data-entry task, not a development task. Given how long the catalogue and price answers have taken, **assume the list arrives late and build so that its arrival is same-day.**

**Dependency on the catalogue ([O-6](../CLIENT-ANSWERS.md)):** R6's eligibility flag should be set during catalogue import, not by hand afterwards. Coordinate with the importer.

**Dependency on [SPEC-05](SPEC-05-backend-owned-config.md):** R1 is backend-owned reference data of exactly the kind SPEC-05 establishes. Reuse the pattern.

**Commercial note worth raising with the client:** this is the single highest-value unbuilt feature in Phase 1A. Every week without it, prescription customers either phone or leave. When chasing [O-3](../CLIENT-ANSWERS.md), it is worth saying plainly that the price list is not admin — it is the thing standing between the store and its main product.

**Estimate:** 2 sprints for R1–R6 once prices are available; 1.5 of those can run in parallel with the block.
