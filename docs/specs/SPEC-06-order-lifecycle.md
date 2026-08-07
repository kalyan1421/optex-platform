# SPEC-06 — Order Lifecycle & Customer Cancellation

**Date:** 2026-08-07 · **Status:** Ready to build (thresholds default-able) · **Owner:** Intern C
**Blocked on client:** Partially — [O-4](../CLIENT-ANSWERS.md) sets the thresholds, but the workflow is fully specified.
**Source:** Client answers B4, B5 · [FEATURE-INVENTORY P-24, P-25](../FEATURE-INVENTORY.md)

---

## Problem Statement

A customer who orders the wrong frame has no way to stop the order. There is no cancellation endpoint; `cancelled` is an admin-only status. Their only route is to phone a branch, where staff have no tool to record the request — so cancellations happen by conversation and are applied, or not, from memory.

The client has now decided the model: **customers may request cancellation, and an admin confirms it**, subject to time and fulfilment-stage rules. That is deliberately not a self-service cancel — Optex wants a human decision, because the answer differs depending on whether the frames have already been picked.

Separately, the client has confirmed **an account is required for both orders and appointments**. Orders already enforce this. **Appointments do not** — the schema carries `contact_name` and `contact_phone` specifically to support guest bookings, and that path is now contrary to the client's decision.

## Goals

1. **A customer can request cancellation themselves**, and can see the outcome without phoning a branch.
2. **Optex decides every cancellation**, with the request, the decision and the decider recorded.
3. **Cancellation eligibility is a rule the admin sets**, not a constant — consistent with [SPEC-05](SPEC-05-backend-owned-config.md).
4. **No order is cancelled after a point where cancelling costs Optex money**, and the customer is told why before they ask.
5. **Account requirement is enforced consistently** across orders and appointments.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Automatic refunds on cancellation | Client policy is "no refunds". A cancellation is not a refund; conflating them creates an expectation the client has explicitly rejected. |
| Partial / line-item cancellation | Not requested. Whole-order only. Adds real complexity to a workflow that has none today. |
| Automated payment reversal | Client answered H5: **the admin updates manually**. Build the visibility, not the automation. |
| Returns / RMA | No refunds means no returns flow. Policy page only. |
| Order modification (change item, change address) | Different feature. Cancel-and-reorder covers it for v1. |
| Customer-initiated appointment cancellation | **Already built and working.** Do not rebuild it. |

## User Stories

### Customer

- As a customer who ordered the wrong frame, I want to request cancellation from my order page, so that I do not have to phone a branch and hope.
- As a customer, I want to see whether my request was approved or declined, and why, so that I know where I stand.
- As a customer whose order is too far along, I want to be told that before I request, so that I am not left waiting for a refusal.
- As a customer, I want to give a reason for cancelling, so that Optex understands the problem — and so that Optex learns from it.

### Optex admin

- As an admin, I want to see pending cancellation requests in one place, so that none sits unanswered.
- As an admin, I want to approve or decline with a reason, so that the customer gets a real answer and we have a record.
- As an admin, I want to see whether the order is paid and how far into fulfilment it is before I decide, so that I am not cancelling something already picked and packed.
- As an admin, I want to set the cancellation window and cut-off stage myself, so that I can tighten it during a busy period.
- As an admin, I want to cancel an order directly without a customer request, so that I can handle a phone call.

### Edge cases

- Cancellation requested for an order that becomes dispatched while the request is pending.
- Request submitted seconds before the window closes.
- Customer requests twice.
- Admin approves a cancellation on an order that was already paid.
- Payment is reversed by the provider on an order already cancelled.
- Customer requests cancellation on an already-cancelled order.

## Requirements

### P0 — Must have

**R1. Customer cancellation request.**

- [ ] A customer can request cancellation on an eligible order from order history and the tracking page
- [ ] A reason is captured — free text, optional
- [ ] Given an ineligible order, when the customer views it, then **no request control is shown** and the reason is stated ("orders can no longer be cancelled once dispatched")
- [ ] Given a request already pending, when the customer requests again, then they see the pending state rather than creating a duplicate
- [ ] The customer receives confirmation that the request was received — **not** that it was approved
- [ ] Requests can only be made against the caller's own orders, verified server-side

**R2. Eligibility is evaluated server-side, from configuration.**
Two independent conditions, both admin-set ([SPEC-05](SPEC-05-backend-owned-config.md)):

| Rule | Default | Configurable |
| --- | --- | --- |
| Time window from order placement | **24 hours** | Yes |
| Fulfilment stage cut-off | **Not after dispatch** | Yes |

- [ ] Eligibility is computed by the API. The storefront displays the answer; it never decides
- [ ] Given either condition fails, then the order is ineligible
- [ ] Given the window is changed, then eligibility for existing orders is re-evaluated against the new value
- [ ] Defaults are documented and applied when unset — never silently zero, which would make everything ineligible

> **These defaults are our decision, not the client's** ([O-4](../CLIENT-ANSWERS.md)). They are configuration precisely so that being wrong costs a minute, not a release.

**R3. Admin approval workflow.**

- [ ] Pending requests appear in the admin panel with a visible count
- [ ] Each shows: order, customer, reason, time since request, payment status, fulfilment stage
- [ ] Admin approves or declines, with a reason on decline
- [ ] Approval sets the order to `cancelled`; decline returns it to its prior status
- [ ] Given the order was dispatched while the request was pending, when the admin opens it, then this is flagged prominently
- [ ] Every decision records who made it and when
- [ ] Admin can still cancel directly, without a request — the phone-call path

**R4. The customer is told the outcome.**

- [ ] Approval and decline both notify by email and SMS, using the existing best-effort services
- [ ] The order page reflects the outcome and shows the decline reason where given
- [ ] Notification failure never blocks or reverses the decision — matches the existing pattern

**R5. Paid orders are handled explicitly, not implicitly.**
Client policy is "no refunds", so approving a cancellation on a paid order needs a deliberate act.

- [ ] Given a paid order, when an admin approves cancellation, then they must explicitly acknowledge that no automatic refund occurs
- [ ] Paid-and-cancelled orders are visibly flagged in the admin Payments screen for manual handling
- [ ] The system never initiates a provider refund

**R6. Close the guest appointment path.**

- [ ] Appointment booking requires authentication
- [ ] `contact_name` / `contact_phone` are retained for **admin-created** bookings (a branch booking for a walk-in caller), not for public guest booking
- [ ] Existing guest appointments remain valid and viewable — do not orphan live bookings

**R7. Reversed payments are visible.**
Client answered H5: the admin handles reversals manually. The system already records a `reversed` status and then does nothing with it.

- [ ] Reversed transactions are surfaced in the admin Payments screen and cannot be missed
- [ ] The associated order is flagged as needing attention
- [ ] No automated action is taken

### P1 — Should have

- **R8.** Cancellation reasons reported in admin analytics — the highest-signal product feedback Optex will get for free.
- **R9.** Auto-decline requests that sit unanswered past a configurable period, so nothing is silently pending forever.
- **R10.** Reorder from a cancelled order — the most common next action after "wrong item".

### P2 — Future considerations

- Partial cancellation, once multi-item orders are common.
- Automated provider refunds, if the client ever reverses the no-refunds policy.
- Cancellation rate as a product-quality signal — sizing and fit issues surface here first.

## Success Metrics

**Leading (30 days):**

| Metric | Success | Method |
| --- | --- | --- |
| Cancellation requests resolved within 24h | > 90% | Admin queue |
| Requests submitted on ineligible orders | < 5% | API logs — a high number means the UI is not explaining eligibility |
| Cancellations handled by phone rather than the system | < 20% | Admin origin field |
| Guest appointment bookings after R6 | **0** | API logs |

**Lagging (first quarter):**

| Metric | Target | Method |
| --- | --- | --- |
| Cancellation rate | < 5% of orders | Order status |
| Cancellations approved after dispatch | 0 | Audit |
| Support contacts about order changes | Declining | Support log |
| Top cancellation reason identified and addressed | 1 product change made | Analytics → roadmap |

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Cancellation window in hours | Client ([O-4](../CLIENT-ANSWERS.md)) | No — defaults to 24h, configurable |
| Q2 | Stage cut-off — after payment, after picking, or after dispatch? | Client ([O-4](../CLIENT-ANSWERS.md)) | No — defaults to dispatch, configurable |
| Q3 | What happens to money on a paid-and-cancelled order, given "no refunds"? | Client ([O-4](../CLIENT-ANSWERS.md)) | **Yes for the customer-facing wording.** R5 makes it a deliberate manual act, but the customer must be told something true |
| Q4 | Should cancellation restore stock to the central pool? | Product | **Yes** once [SPEC-02 R2](SPEC-02-checkout-fulfilment.md) lands — cancelling must not silently lose stock |
| Q5 | Can branch staff approve cancellations, or Super Admin only? | Client / CR-01 RBAC | No — Super Admin until RBAC lands |
| Q6 | Do existing guest appointments need migrating to accounts? | Product | No — specced as preserve-and-honour |

## Timeline Considerations

**Buildable now.** The workflow is fully specified; only the thresholds are open, and they are configuration with documented defaults.

**Sequence:** R6 first — it is small, it is a client decision already made, and it closes an inconsistency. Then R1–R4 as the core workflow. R5 and R7 alongside.

**Dependency on [SPEC-05](SPEC-05-backend-owned-config.md):** R2 reads its window and stage from the settings store. Either land SPEC-05 R1 first, or ship constants and migrate — **prefer landing SPEC-05 R1 first**, since shipping constants is the exact pattern this whole programme is unwinding.

**Dependency on [SPEC-02](SPEC-02-checkout-fulfilment.md):** Q4. Once stock is decremented at order placement, cancellation must return it. Build the decrement behind a single function so the restore is its inverse rather than a second implementation.

**Estimate:** 1.5 sprints. R6 is a day; the rest is one solid sprint.
