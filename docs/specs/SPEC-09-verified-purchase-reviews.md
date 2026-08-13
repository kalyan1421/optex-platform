# SPEC-09 — Verified-Purchase Reviews

**Date:** 2026-08-13 · **Status:** Unblocked, no client dependency · **Owner:** TBD
**Source:** [FEATURE-STATUS §3](../FEATURE-STATUS.md), `0009_rls_write_lockdown.sql:48-53`

> **Prior art exists.** `archive/venky-optex:Backend/supabase/migrations/0009_storefront_features.sql` (lines 110-162) already built this once: the same column, a `before insert` trigger computing the flag, and a backfill `UPDATE` for pre-existing rows. It is **not directly reusable** — that branch predates this codebase's write-lockdown migration and the trigger's rule is looser than R1 below (`status <> 'cancelled'` only, with no `payment_status = 'paid'` check, so an order that was placed but never actually paid — an abandoned M-Pesa prompt — would count as verified). Worth reading before building; not worth copying as-is.

---

## Problem Statement

`product_reviews` has no `verified_purchase` column, and `ReviewsService.createForProduct` (`apps/api/src/modules/reviews/reviews.service.ts:75-122`) never checks whether the reviewer bought the product — anyone with an account can review anything. Migration `0009`'s comment already documents this honestly: _"there is no verified-purchase check on either path... the schema has no verified_purchase column."_ It is a known, named gap, not a hidden one.

Every review on a product detail page therefore carries the same visual weight whether it is from a buyer or not. For a considered purchase like eyewear — where fit, weight and lens clarity matter more than most product categories — that undermines the one thing reviews exist to provide: a credible signal from someone who actually used the thing.

## Goals

1. **Every review is tagged as verified or not**, computed server-side at submission time from real order data — never client-supplied, never inferable by the client.
2. **The distinction is visible** on the product page, so a shopper can weight a verified review differently from an unverified one.
3. **Existing reviews get the same treatment** — a one-time backfill, not just new submissions going forward.
4. **Review volume does not regress.** The fix is a trust signal, not a submission gate — see Non-Goals.

## Non-Goals

| Not doing                                                            | Why                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gating reviews to verified purchasers only                           | A real design choice (see Open Questions) but the riskier default for a platform with still-low review volume. Labelling preserves both signal and volume; gating can follow later as configuration if Optex wants it stricter. |
| Requiring delivery confirmation (vs. payment) to count as "verified" | Optex has no delivery-confirmation event today — fulfilment stage is admin-set, not customer-confirmed. Requiring `delivered` would tie this feature to a signal that does not reliably exist yet.                              |
| Retroactively hiding or deleting existing unverified reviews         | They were submitted under the rules that existed at the time. Backfilling the flag is corrective; deleting content is not this spec's call to make.                                                                             |
| Verified badges on admin replies or any non-customer content         | Not applicable — `admin_reply` is not a review.                                                                                                                                                                                 |

## User Stories

### Shopper

- As a shopper reading reviews, I want to see which ones are from verified buyers, so that I can weight feedback about fit and quality more confidently.
- As a shopper who bought a product, I want my review automatically marked verified, so that my feedback carries the credibility it has earned — without an extra step.
- As a shopper who has not bought the product, I want to still be able to leave a review, so that pre-purchase questions or feedback from a showroom visit are not shut out.

### Optex

- As a moderator, I want the verified flag visible in the admin review queue, so that I can weigh unverified reviews more carefully before approving them.
- As Optex, I want the "verified purchase" claim to be true by construction — computed from `orders`/`order_items`, not a checkbox a reviewer ticks — so the label means something.

### Edge cases

- A customer buys a product, reviews it, then the order is later cancelled (SPEC-06). The review was genuinely verified at submission time; it stays verified — cancellation is not requesting a refund of the customer's opinion.
- A customer reviews a product before their order is placed under a different session/account with the same email (cannot happen without account linking — not applicable).
- A product is later renamed or its variant restructured; the verification lookup must still match on `product_id`, unaffected by display fields.

## Requirements

### P0 — Must have

**R1. `verified_purchase` column, computed and stored at write time.**

- [ ] `product_reviews.verified_purchase boolean not null default false`
- [ ] `CreateReviewDto` has no `verifiedPurchase` field — it cannot be client-supplied
- [ ] Given the reviewer has a `paid`, non-`cancelled` order containing the reviewed `product_id`, when they submit a review, then `verified_purchase = true`
- [ ] Given no such order exists, then `verified_purchase = false` and the review is still accepted
- [ ] Implementation choice: compute this in `ReviewsService.createForProduct` (consistent with where the rest of this service's business logic lives, and easier to unit-test alongside it) **or** as a `before insert` trigger (the prior-art approach above, which has the advantage of holding even if a future write path bypasses the service). Either is acceptable; do not do both.

**R2. One-time backfill for existing reviews.**

- [ ] A migration (or a one-off script run once, documented in the migration file) recomputes `verified_purchase` for every existing row using the same rule as R1
- [ ] Given a review predates the reviewer's qualifying order for unrelated reasons (e.g. re-purchase), the backfill still evaluates against _any_ qualifying order, not just the one temporally closest to the review

**R3. The product page shows the distinction.**

- [ ] A review from a verified purchase carries a visible "Verified Purchase" badge; an unverified review carries none (not a "Not Verified" badge — the default state should not read as an accusation)
- [ ] `apps/web/app/product/[slug]/page.jsx`'s `ReviewsSection` renders the flag already returned by `GET /products/:productId/reviews` — no new API round trip

**R4. The admin moderation queue shows the flag.**

- [ ] `AdminReviewDto` includes `verified_purchase`
- [ ] The admin Reviews screen displays it per row, so a moderator can weigh an unverified review more carefully

**R5. Housekeeping.** Once R1–R2 ship, the caveat in `0009_rls_write_lockdown.sql`'s comment ("there is no verified-purchase check... the schema has no verified_purchase column") is stale and should be corrected in the same change — not left to rot as the next person's confusion.

### P1 — Should have

- **R6.** Filter the product-page review list to verified-only.
- **R7.** Verified reviews sort first within the default `created_at desc` order, so the most credible feedback is seen first without hiding the rest.

### P2 — Future considerations

- Configurable review gating (require a qualifying purchase to review at all), as an `app_settings` toggle if Optex later decides labelling alone is not strict enough — SPEC-05's pattern is the natural fit if this is ever wanted.
- Extending the same "verified" concept to Q&A or a future "verified consultation" signal once CR-01's doctor module exists. Not building anything toward this now; noted so R1's design (a boolean, not an enum) is not accidentally boxed in — a second boolean column is cheap to add later; retrofitting an enum is not.

## Success Metrics

**Leading (first 30 days):**

| Metric                       | Success                                | Method                                       |
| ---------------------------- | -------------------------------------- | -------------------------------------------- |
| New reviews correctly tagged | 100% (spot-checked against `orders`)   | Manual audit, weekly for first month         |
| Backfill coverage            | 100% of pre-existing reviews evaluated | One-time migration log                       |
| Review submission rate       | Holds at pre-change level              | Compare weekly submission count before/after |

**Lagging (first quarter):**

| Metric                                               | Target                                            | Method                 |
| ---------------------------------------------------- | ------------------------------------------------- | ---------------------- |
| Share of reviews carrying `verified_purchase = true` | Baseline established, then track trend            | Admin query            |
| Reviews approved that were later disputed as fake    | Trend downward (directional, low volume expected) | Admin moderation notes |

## Open Questions

| #   | Question                                                                                                                                                 | Owner          | Blocking?                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| Q1  | Should "verified" require `payment_status = 'paid'` only, or also exclude orders currently `cancelled`? This spec defaults to **paid AND not cancelled** | Product        | No — build the default; confirm before R1 ships if disagreement surfaces |
| Q2  | Should reviewing ever be gated to verified purchasers only (vs. label-only, this spec's default)?                                                        | Product/Client | No — P2, revisit if fake-review volume becomes a real problem            |

## Timeline Considerations

No client dependency — this is entirely a data-model and application-logic gap on Optex's own schema. R1–R5 (P0) are a single small migration plus service/DTO changes plus two UI badges; **estimate: 2-3 days.** R6–R7 (P1) are a filter/sort tweak on an already-loaded list — **estimate: half a day**, natural fast-follow.
