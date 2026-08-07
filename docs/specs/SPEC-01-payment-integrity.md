# SPEC-01 — Payment Integrity Hardening

**Date:** 2026-08-07 · **Status:** Ready to build · **Owner:** Kalyan (payments are not delegated)
**Blocked on client:** No. Every requirement here can start today.
**Source:** [CODE-REVIEW.md](../CODE-REVIEW.md) C-1, C-2, C-3, M-1, M-3

---

## Problem Statement

The M-Pesa payment path credits an order based on an **unauthenticated HTTP request that anyone can send**. A customer can place an order, read the `checkoutRequestId` the API returns to them, decline the M-Pesa prompt, then POST a forged success callback and receive goods without paying. Two further defects in the same path let an unauthenticated caller credit *another customer's* order, and let any logged-in customer place an order against another customer's cart.

Optex is a 27-branch retailer whose entire online revenue flows through this path. The cost of not solving it is not a degraded experience — it is unbounded free-goods fraud from launch day one, discovered only at monthly stock reconciliation, by which time the frames are gone.

## Goals

1. **No order reaches `payment_status = 'paid'` without the payment provider independently confirming it.** Measured by: forged-callback test cases fail closed in CI.
2. **No unauthenticated request can select or mutate a transaction it does not identify exactly.** Measured by: injection test suite passes.
3. **No database function trusts a caller-supplied identity.** Measured by: zero `SECURITY DEFINER` functions accepting an identity parameter while granted to `authenticated`.
4. **Every credit path verifies the amount**, including admin-initiated ones. Measured by: mismatch cases are surfaced and require explicit override.
5. **Go-live is unblocked** — this spec is the gate. No payments-live date can be committed until it ships.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Cryptographic webhook signature verification | Neither Daraja STK callbacks nor Pesapal IPN are signed by the provider. There is no signature to verify. Re-query is the correct control. |
| Provider IP allow-listing | Correct as defence-in-depth, but it lives at the edge and hosting is still "client managed" and undecided ([CLIENT-QUESTIONS D5](../CLIENT-QUESTIONS.md)). Do it when the environment exists; do not let it gate this work. |
| Refund or reversal automation | Client policy is "no refunds"; provider-side reversals need an operational owner first ([CLIENT-QUESTIONS H5](../CLIENT-QUESTIONS.md)). Out of scope until answered. |
| Rewriting the Pesapal path | It is already correct. It is the reference implementation this spec copies. |
| Payment retries / dunning | No evidence of need. Premature. |

## User Stories

**As Optex**, I want an order to be marked paid only when Safaricom or Pesapal confirms the money arrived, so that dispatch decisions are based on real payments.

**As a customer**, I want my genuine payment to be recognised promptly even if the callback is lost, so that I am not chased for money I already sent. *(Preserved by the existing polling cron and the re-query path — must not regress.)*

**As the Optex finance operator**, I want a payment whose amount does not match the order to be flagged rather than silently applied, so that I catch underpayments before dispatch.

**As the Optex finance operator**, I want to link an orphan payment to an order without being able to accidentally credit the wrong amount, so that a reconciliation under pressure does not create a loss.

**Edge cases:**
- Duplicate callback for an already-credited order → no second credit, no second SMS.
- Callback arrives before the STK push row is committed → no crash, transaction found on the polling retry.
- Provider unreachable during re-query → order stays pending, cron retries. Never credit on a failed re-query.

## Requirements

### P0 — Must have

**R1. The M-Pesa callback becomes a trigger, not a source of truth.**
`handleMpesaCallback` must ignore the posted `ResultCode` and `CallbackMetadata` entirely as a basis for crediting. It reads only `CheckoutRequestID`, then calls `mpesa.stkQuery()` and acts on Daraja's response — exactly as `handlePesapalIpn` does today.

- [ ] Given a forged callback with `ResultCode: 0` and no real payment, when it is received, then `stkQuery` reports failure and the order is **not** credited
- [ ] Given a genuine successful payment, when the callback arrives, then `stkQuery` confirms and the order is credited exactly once
- [ ] Given `stkQuery` throws or times out, then the transaction stays `pending` and the order is not credited
- [ ] The provider still receives `{ResultCode: 0, ResultDesc: "Accepted"}` in all cases — no retry storms
- [ ] The raw posted body is still persisted to `raw` for audit

**R2. Amount verification is mandatory, not conditional.**
Change `applyMpesaSuccess` from "verify if `info.amount` is present" to "require present and matching". An absent amount is a mismatch, not a pass.

- [ ] Given a success path where the provider reports no amount, then the transaction is held for manual reconcile and the order is not credited
- [ ] Given a reported amount differing from `tx.amount_kes` by more than 0.01, then held for manual reconcile
- [ ] Held transactions appear in the admin Payments screen with a visible `amount_mismatch` reason

**R3. Eliminate the PostgREST filter injection.**
Replace the interpolated `.or()` in `findMpesaTxByCheckout` with parameter-safe queries.

- [ ] Given `CheckoutRequestID` containing `,` `.` `(` `)` or `*`, then no additional rows match and no unintended transaction is returned
- [ ] Ids are validated against `^[A-Za-z0-9_-]{1,64}$` before reaching any filter; failures are logged and rejected
- [ ] Pre-receipt and post-receipt lookups both still resolve correctly

**R4. Remove the caller-supplied identity from `place_order`.**
New migration `0009`. Either resolve the customer internally via the existing `current_customer_id()`, or revoke `authenticated` execute and keep the function service-role-only. **Recommendation: do both.**

- [ ] Given a logged-in customer calling `place_order` with another customer's uuid, then the call fails
- [ ] `OrdersService.checkout` continues to work unchanged
- [ ] `increment_promo_uses` is revoked from `authenticated` in the same migration
- [ ] A repo-wide check confirms no other `SECURITY DEFINER` function takes an identity parameter while granted to `authenticated`

**R5. `adminLinkPayment` verifies amount and order state.**

- [ ] Given a transaction amount differing from the order total, then the operator sees the mismatch and must pass an explicit override to proceed
- [ ] Given an order already `paid`, then linking reports "already paid" and does not re-credit
- [ ] Every link action records who performed it and whether an override was used

**R6. Reject COD at the API boundary.**
The client is not offering Cash on Delivery, but `place_order` still routes `'cod'` straight to `received`, creating a fulfillable unpaid order.

- [ ] Given a checkout request with `paymentMethod: 'cod'`, then the API rejects it with a clear message
- [ ] The rejection is a single-line config change to re-enable if the client reverses the decision

**R7. Regression tests exist for every one of the above.**
This is P0, not P1. These defects were shipped and marked ✅ because nothing tested them.

- [ ] Forged-callback test, injection test, cross-customer `place_order` test, duplicate-callback idempotency test
- [ ] All run in CI on every PR

### P1 — Should have

- **R8.** Rate-limit `/api/webhooks/mpesa` by `CheckoutRequestID` rather than removing throttling entirely — `@SkipThrottle()` currently permits unlimited requests.
- **R9.** Structured alert (email to the finance operator) when a transaction is held for manual reconcile.
- **R10.** Admin Payments screen filter for "held / mismatched", so held items cannot sit unnoticed.

### P2 — Future considerations

- Provider IP allow-listing once hosting is decided.
- An `audit_log` table capturing every admin payment action — arrives with CR-01 RBAC; design R5's logging so it can migrate into it rather than being rewritten.
- eTIMS invoice emission on credit (CR-02) — R1's single credit path is the natural hook. Do not scatter credit logic now.

## Success Metrics

**Leading (measured at merge, then weekly):**

| Metric | Target | Method |
| --- | --- | --- |
| Forged-callback test cases failing closed | 100% | CI |
| Orders credited without a provider re-query | 0 | Log audit |
| Injection test suite | Passing | CI |
| Held-for-reconcile transactions resolved within 24h | 100% | Admin Payments screen |

**Lagging (first 90 days after payments go live):**

| Metric | Target | Method |
| --- | --- | --- |
| Orders dispatched against unconfirmed payment | 0 | Monthly reconciliation vs. Daraja/Pesapal statements |
| Value of unexplained stock shrinkage attributable to online orders | KES 0 | Monthly stock reconciliation |
| Payment disputes requiring manual investigation | < 1% of orders | Support log |

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Does Daraja `stkQuery` return a definitive failure quickly enough to answer the callback inline, or do we ack first and reconcile asynchronously? | Engineering (Kalyan) — spike against sandbox | **Yes** — decides R1's shape |
| Q2 | On a held mismatch, do we contact the customer automatically or leave it to the operator? | Client (relates to [H5](../CLIENT-QUESTIONS.md)) | No — default to operator-only |
| Q3 | Who is the named finance operator receiving R9's alerts? | Client ([H6](../CLIENT-QUESTIONS.md)) | No — build the alert, address it later |
| Q4 | Should `stkQuery` failures retry inline or rely solely on the existing polling cron? | Engineering | No — cron already covers it |

## Timeline Considerations

**This is a hard gate on go-live.** No payments-live date can be committed before R1–R7 ship.

**Sequencing:** R1+R2+R3 are one file and should land as one PR. R4 is an independent migration and can land in parallel. R5, R6 are small. R7 lands with each.

**Dependency:** R7 needs CI to exist. CI is Kalyan's week-1 task in [TEAM-PLAN §2](../TEAM-PLAN.md) — it is now a prerequisite for this spec, which raises its priority from "unblocks the interns" to "unblocks go-live".

**Estimate:** 1 sprint (2 weeks) for P0 including tests, assuming Q1 resolves in the first two days.
