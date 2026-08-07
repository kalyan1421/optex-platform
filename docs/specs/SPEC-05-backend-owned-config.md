# SPEC-05 — Backend-Owned Configuration & Content

**Date:** 2026-08-07 · **Status:** Ready to build · **Owner:** Intern C (settings) + Intern A (content)
**Blocked on client:** No. Two content items need their text ([O-3](../CLIENT-ANSWERS.md), E4/E5) but the mechanism does not.
**Source:** Client instruction — *"make perfect product that has backend, everything from backend only"* · [FEATURE-INVENTORY Part 4](../FEATURE-INVENTORY.md)

---

## Problem Statement

Optex cannot change how their own storefront behaves. The delivery charge, the VAT rate, appointment slot length, opening hours, the free-delivery threshold, the returns policy, the homepage testimonials — all are written into source code. Changing any of them requires a developer, a pull request and a deploy.

The consequences are already visible in production-bound code: the storefront publishes a **returns policy that contradicts the client's stated "no refunds"**, advertises a **Virtual Try-On feature that does not exist**, and carries **three invented customer testimonials with American names** on a Kenyan retailer's homepage. None of these are bugs. They are the predictable result of content living in JSX.

The client asked for this directly. It is not a refactor — it is the difference between software Optex operates and software Optex must file tickets against.

## Goals

1. **An Optex admin can change any commercial rule** — delivery charge, thresholds, VAT, appointment rules — **without a deploy.**
2. **An Optex admin can edit every customer-facing policy and marketing text** without a deploy.
3. **No business rule is written twice.** Today VAT exists in TypeScript and SQL, kept in sync by a comment.
4. **Nothing false is published.** Fabricated testimonials and a non-existent feature are removed or replaced before launch.
5. **Every setting change is attributable** — who changed the delivery charge, when, from what to what.

## Non-Goals

| Not doing | Why |
| --- | --- |
| A general-purpose CMS | Optex needs to edit a known, finite set of pages. A CMS is a project; a settings table with a rich-text field is an afternoon. |
| Making the entire homepage layout editable | Layout changes are design work. Editable *copy* covers the real need. |
| Per-branch commercial settings | Client confirmed a single central stock pool and one shared branch pattern. Per-branch scoping is [SPEC-04](SPEC-04-appointment-scheduling.md)'s job for appointments only. |
| Versioning / draft-and-publish for content | No evidence of need. An audit trail (R6) covers the real risk, which is "who broke this". |
| Migrating the browser-side data access | Same instruction, different work — tracked in [ROADMAP Waves 1–5](../ROADMAP.md) and [SPEC-03](SPEC-03-storefront-seo-render.md). This spec covers *hardcoded values and content*, not *where reads happen*. |
| Translations | Not requested. |

## User Stories

### Optex admin

- As an Optex admin, I want to change the delivery charge when my courier rates change, so that I am not undercharging while I wait for a developer.
- As an Optex admin, I want to set the free-delivery threshold, so that I can run the offer I actually want.
- As an Optex admin, I want to update the VAT rate when KRA changes it, in one place, so that cart totals and invoices cannot disagree.
- As an Optex admin, I want to edit the returns, delivery, warranty and privacy pages, so that what we publish matches what we do — this is legally relevant, not cosmetic.
- As an Optex admin, I want to add real customer testimonials and remove ones I have not verified, so that we are not publishing invented reviews.
- As an Optex admin, I want to hide the Virtual Try-On section until the feature exists, so that we do not advertise something we cannot deliver.
- As an Optex admin, I want to see who changed a setting and when, so that a wrong price has an owner.

### Customer

- As a customer, I want the delivery charge I am shown to be the charge I am billed, so that the total is trustworthy.
- As a customer, I want the published returns policy to be the policy that is actually applied, so that I know where I stand before I buy.

### Edge cases

- A setting is changed while a customer has an in-progress cart priced under the old value.
- VAT changes between order placement and invoice generation.
- A setting is saved with a nonsensical value (negative charge, 400% VAT).
- The settings table is empty on a fresh environment.
- Two admins edit the same policy page simultaneously.

## Requirements

### P0 — Must have

**R1. A settings store with typed, validated values.**
A single backend-owned source for every commercial rule, read by the API — never by the browser directly.

- [ ] Settings are stored in the database with a type, a value, and validation bounds
- [ ] Given an out-of-range value (negative charge, VAT above 100%), when an admin saves, then it is rejected with a clear message
- [ ] Given an empty settings table, then the system uses documented defaults and logs that it did so — it must not crash or silently use zero
- [ ] Settings are read server-side only; no setting reaches the browser except as a rendered value
- [ ] Reads are cached with explicit invalidation on write — this is on the hot path for every cart render

**R2. Commercial settings, admin-editable.**
The client asked specifically for the delivery charge. Ship the set together — the mechanism is the same and doing them one at a time is the expensive way.

| Setting | Current location | Default |
| --- | --- | --- |
| Delivery charge | Inline in `place_order` SQL | KES 300 *(client-confirmed)* |
| Free-delivery threshold | Does not exist | **Blocked — see [O-1](../CLIENT-ANSWERS.md)** |
| Free-delivery scope | Does not exist | Blocked with the above |
| VAT rate | `cart.service.ts:16` **and** SQL | 16% |
| Order cancellation window | Does not exist | See [SPEC-06](SPEC-06-order-lifecycle.md) |

- [ ] Given an admin changes the delivery charge, when a customer next views their cart, then the new charge applies with no deploy
- [ ] The charge shown in the cart equals the charge placed on the order — asserted by test, not by comment
- [ ] Given an order already placed, when a setting changes, then that order's stored totals do not change

**R3. VAT has exactly one implementation.**
Today `place_order`'s header comment instructs future maintainers to keep the SQL and TypeScript maths aligned "EXACTLY". Kenya's VAT rate is legislated and will change; when it does, one of the two will be missed, and the failure is silent and financial.

- [ ] Cart preview and order placement compute VAT from the same source
- [ ] A test asserts cart-preview total equals placed-order total for an identical cart
- [ ] Given the VAT rate is changed, when one value is updated, then both paths reflect it

**R4. Policy pages become editable content.**
Four pages, ~780 hardcoded lines, at least two of which currently publish something the client has told us is wrong.

- [ ] Returns, delivery, warranty and privacy pages render from stored content
- [ ] Admin can edit each with basic formatting
- [ ] Pages remain server-rendered and indexable — this must not regress [SPEC-03](SPEC-03-storefront-seo-render.md)
- [ ] **The returns page is rewritten to state "no refunds" before launch** — it currently describes a returns process the client does not operate
- [ ] The delivery page reflects the confirmed model

**R5. Homepage content becomes editable — and the two false sections are dealt with.**

- [ ] Testimonials are stored, not hardcoded. **The three invented entries are deleted.**
- [ ] Given no verified testimonials exist, when the homepage renders, then the section is hidden entirely — an empty testimonials section is better than a fabricated one
- [ ] The Virtual Try-On section can be hidden by an admin, and **ships hidden by default** until Phase 3 exists
- [ ] Hero, WhyOptex, FinalCTA and Promotional copy are editable

**R6. Every setting and content change is audited.**

- [ ] Each change records who, when, the old value and the new value
- [ ] Audit entries are visible to a Super Admin
- [ ] Design note: CR-01 introduces a general `audit_log` with a 3-month retention ([CLIENT-ANSWERS §4](../CLIENT-ANSWERS.md)). **Write this to a shape that can migrate into it**, rather than building something that must be replaced.

### P1 — Should have

- **R7.** Reference data — the Kenya counties list currently hardcoded at `checkout/page.jsx:108` — moves to the database alongside pickup stations ([SPEC-02](SPEC-02-checkout-fulfilment.md)).
- **R8.** A settings screen grouped by domain (commerce, appointments, content) rather than a flat list. At ~15 settings a flat list is tolerable; it will not stay at 15.
- **R9.** Face-shape guide content editable.
- **R10.** "Preview before publish" on policy pages — these are legally relevant and a typo ships instantly.

### P2 — Future considerations

- Per-branch commercial overrides, if central pricing ever changes.
- Scheduled content changes (seasonal campaigns).
- Content versioning with rollback.

## Success Metrics

**Leading (30 days post-launch):**

| Metric | Success | Method |
| --- | --- | --- |
| Commercial rules changeable without a deploy | 100% of the R2 set | Checklist |
| Deploys required for a content or price change | **0** | Deploy log |
| Fabricated content in production | **0** | Pre-launch content audit |
| Published policies contradicting stated client policy | **0** | Legal review sign-off |
| Cart-total vs order-total mismatches | 0 | Automated test + reconciliation |

**Lagging (first quarter):**

| Metric | Target | Method |
| --- | --- | --- |
| Client change requests requiring developer time for copy or pricing | Trending to zero | Ticket log |
| Time from "client wants a price change" to live | < 10 minutes | Observed |
| Setting changes without an attributable owner | 0 | Audit log |

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Free-delivery threshold in KES, and whether it is countrywide or Nairobi-only | Client ([O-1](../CLIENT-ANSWERS.md)) | **Yes** for that setting only — the rest of R2 proceeds |
| Q2 | Approved returns and warranty wording | Client (E4, E5) | No for R4's mechanism; **yes** before launch |
| Q3 | Real testimonials — 3–5 with names and permission to publish | Client (E2) | No — R5 hides the section if empty |
| Q4 | Virtual Try-On: remove entirely, or "coming soon"? | Client (E3) | No — defaults to hidden |
| Q5 | Named Data Protection Officer for the privacy page | Client (F1) | No for build; **yes** for DPA 2019 compliance |
| Q6 | Should a VAT change apply to unpaid orders already placed? | Product (Kalyan) | No — specced as "placed orders keep their stored totals"; confirm |
| Q7 | Who at Optex is trusted to edit policy pages? Legal text is not a general admin permission | Client / CR-01 RBAC | No — Super Admin only until RBAC lands |

## Timeline Considerations

**Unblocked and high-leverage.** Every hour spent here removes a future change request and eliminates a class of "we need a deploy to fix a price" incident.

**Sequence:** R1 (store + validation) → R2 + R3 (commercial, the client's explicit ask) → R4 + R5 (content, the pre-launch correctness fixes) → R6 (audit).

**Launch dependency:** R4 and R5 are **launch blockers on correctness grounds**, not feature grounds. Publishing a returns policy that contradicts your stated terms is a customer-facing legal exposure, and publishing invented testimonials on a real retailer's site is worse. Neither should reach production.

**Interaction with [SPEC-02](SPEC-02-checkout-fulfilment.md):** R2's delivery settings are what SPEC-02's shipping-rule engine reads. Build R1/R2 first so SPEC-02 has somewhere to read from.

**Interaction with [SPEC-08](SPEC-08-cr01-phase-1b.md):** R6's audit shape should anticipate CR-01's `audit_log`. Ten minutes of thought now avoids rewriting it later.

**Estimate:** 2 sprints. R1–R3 in the first, R4–R6 in the second.
