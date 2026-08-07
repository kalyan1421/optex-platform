# OPTEX — Code Review

**Date:** 2026-08-07 · **Branch:** `development` @ `0d2233f`
**Scope:** `apps/api`, `apps/web`, `apps/admin`, `Backend/supabase/migrations`
**Method:** direct code reading. Every finding below cites `file:line` and was traced to an exploit path or failure case. Findings I could not trace to a concrete failure are not listed.

**Relationship to the other docs:** [ROADMAP.md](ROADMAP.md) covers *architectural* debt (TD-1…TD-9) and [FEATURE-STATUS.md](FEATURE-STATUS.md) covers *feature completeness*. This document covers *correctness and security defects in code that is already shipped and marked done*. Findings **C-1, C-2, C-3, H-1 and H-2 appear in no other document** — all five sit inside features currently marked ✅.

---

## Severity summary

| ID | Finding | Severity | Feature marked as |
| --- | --- | --- | --- |
| **C-1** | Unauthenticated payment forgery via the M-Pesa webhook | **Critical** | ✅ Done |
| **C-2** | PostgREST filter injection in the M-Pesa transaction lookup | **Critical** | ✅ Done |
| **C-3** | `place_order` is SECURITY DEFINER, takes the caller's identity as a parameter, and is granted to `authenticated` | **Critical** | ✅ Done |
| **H-1** | Orders never check or decrement stock — unlimited overselling | **High** | 🟡 Partial |
| **H-2** | Appointment double-booking is also a race in the API, not just the admin browser write | **High** | ✅ Done |
| **H-3** | **The customer booking path never reaches the API and has no validation at all** *(added 2026-08-07)* | **High** | ✅ Done |
| **M-1** | `adminLinkPayment` credits an order with no amount and no state check | **Medium** | ✅ Done |
| **M-2** | Money constants duplicated across SQL and TypeScript | **Medium** | ✅ Done |
| **M-3** | COD still live in the checkout RPC after the client withdrew it | **Medium** | ✅ Done |

---

## C-1 — Unauthenticated payment forgery via the M-Pesa webhook

**Any customer can mark their own order paid, for free, with one unauthenticated HTTP request.**

`POST /api/webhooks/mpesa` is `@Public()` and `@SkipThrottle()` ([webhooks.controller.ts:30-41](../apps/api/src/modules/payments/webhooks.controller.ts#L30-L41)). Its body is typed `unknown`, so the global `ValidationPipe` has no metatype and does not validate it. `handleMpesaCallback` then **trusts the posted `ResultCode`** and credits the order directly ([payments.service.ts:253-264](../apps/api/src/modules/payments/payments.service.ts#L253-L264)).

The amount check that is supposed to catch this is conditional:

```ts
// payments.service.ts:293
if (info.amount !== undefined && Math.abs(Number(info.amount) - Number(tx.amount_kes)) > 0.01) {
```

`info.amount` comes from `CallbackMetadata`. **Omit `CallbackMetadata` entirely and the check is skipped**, not failed.

### Exploit chain (all steps use documented, shipped endpoints)

1. Place an order normally → `status = 'pending_payment'`.
2. `POST /api/payments/mpesa/stkpush` → the response body **returns `checkoutRequestId`** to the caller ([payments.service.ts:176-182](../apps/api/src/modules/payments/payments.service.ts#L176-L182)).
3. Ignore or decline the STK prompt. The transaction stays `pending`.
4. `POST /api/webhooks/mpesa` with no auth:
   ```json
   {"Body":{"stkCallback":{"CheckoutRequestID":"<from step 2>","ResultCode":0,"ResultDesc":"ok"}}}
   ```
5. Transaction is not final → `resultCode === 0` → `applyMpesaSuccess` with `amount: undefined` → amount check skipped → `creditOrder()` sets `payment_status='paid'`, `status='processing'` and fires the confirmation SMS and email.

### Why the documented mitigations don't hold

[main.ts:35-41](../apps/api/src/main.ts#L35-L41) names three controls. All three are absent on this path:

| Control claimed | Actual state |
| --- | --- |
| (a) Provider IP allow-listing at the edge | Not implemented anywhere in the repo. Hosting is "client managed" and undecided, so there is no edge to configure. |
| (b) Server-side status re-query | **Pesapal does this correctly** — `handlePesapalIpn` reads only the tracking id and re-queries `GetTransactionStatus` ([payments.service.ts:450-465](../apps/api/src/modules/payments/payments.service.ts#L450-L465)). **M-Pesa does not** — it believes the posted body. |
| (c) Amount verification | Skipped when `CallbackMetadata` is absent, as above. |

The asymmetry is the tell: the Pesapal path already encodes the correct pattern. M-Pesa was left trusting.

### Fix

In `handleMpesaCallback`, treat the callback purely as a *trigger*: call `this.mpesa.stkQuery(CheckoutRequestID)` and act on Daraja's answer, mirroring `handlePesapalIpn`. Change the amount guard from "verify if present" to "require present and matching before crediting". Add Safaricom IP allow-listing at the edge once hosting is settled — as defence in depth, not as the primary control.

---

## C-2 — PostgREST filter injection in `findMpesaTxByCheckout`

[payments.service.ts:958](../apps/api/src/modules/payments/payments.service.ts#L955-L961) interpolates a caller-controlled string into a raw PostgREST filter:

```ts
.or(`mpesa_ref.eq.${checkoutRequestId},raw->>CheckoutRequestID.eq.${checkoutRequestId}`)
```

In PostgREST, `,` separates OR terms. `checkoutRequestId` reaches this function from the **unauthenticated webhook body** (C-1, step 4) and from a request parameter on `queryMpesaStatus`.

A crafted value such as `x,status.eq.pending` expands the filter to match **any pending transaction**, and the query is `.order('received_at', {ascending: false}).limit(1)` — so it returns *the most recent pending transaction in the system*, belonging to an arbitrary customer. Chained with C-1, an attacker who has never placed an order can credit a stranger's order.

**Fix:** replace the interpolated `.or()` with two explicit `.eq()` queries, or validate the id against `^[A-Za-z0-9_-]+$` before it reaches the filter. Prefer both.

---

## C-3 — `place_order` trusts a caller-supplied customer id and is granted to `authenticated`

[0008_api_hardening.sql:95-105](../Backend/supabase/migrations/0008_api_hardening.sql#L95-L105) declares:

```sql
CREATE OR REPLACE FUNCTION place_order(p_customer_id uuid, ...)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

and then grants it broadly:

```sql
GRANT EXECUTE ON FUNCTION place_order(uuid, text, jsonb, text, text) TO authenticated, service_role;
```

`SECURITY DEFINER` bypasses RLS, and the function **never verifies that the caller owns `p_customer_id`**. The storefront ships an anon-key Supabase client into the browser holding the user's JWT (`context/AuthContext.js:33`), so the `authenticated` role is directly reachable from the client. Any logged-in customer can call:

```js
supabase.rpc('place_order', { p_customer_id: '<another customer uuid>', ... })
```

which places an order against that customer's cart, bumps promo usage, and **deletes their cart items**.

Migration 0006 already added `current_customer_id()` — a `SECURITY DEFINER` helper that resolves the caller's own customer id — and it is not used here.

**Fix:** either drop the `p_customer_id` parameter and resolve it internally via `current_customer_id()`, or `REVOKE EXECUTE ON FUNCTION place_order(...) FROM authenticated` and keep it service-role-only, since `OrdersService.checkout` ([orders.service.ts:134](../apps/api/src/modules/orders/orders.service.ts#L134)) is the only intended caller and uses the service-role client.

**Same class, lower impact:** `increment_promo_uses(text)` is also granted to `authenticated`. Any logged-in user can call it in a loop to burn a promo code to its `max_uses` cap and deny it to real customers. Low urgency only because the client has no promotions at launch.

---

## H-1 — Orders never check or decrement stock

`grep -rn "stock" apps/api/src` outside `modules/inventory/` returns **zero hits**. Specifically:

- `CartService` does not check availability when adding an item.
- `place_order` ([0008_api_hardening.sql:120-237](../Backend/supabase/migrations/0008_api_hardening.sql#L120-L237)) computes subtotal, discount, VAT, shipping and total, inserts `order_items`, bumps the promo and clears the cart — and **never touches `inventory`**.
- `inventory.stock` is only ever written by an admin typing into the grid ([inventory.service.ts:94-111](../apps/api/src/modules/inventory/inventory.service.ts#L94-L111)).

A customer can order 1,000 units of a product with a stock level of 1, repeatedly, and nothing in the system objects. There is no reservation, no decrement, no out-of-stock state on the PDP.

[FEATURE-STATUS.md](FEATURE-STATUS.md) marks Inventory 🟡 "stock-level editor only — no ledger, no movements, no reorder threshold", which reads as a CR-01 depth gap. It is more than that: **the stock number the admin maintains has no connection to the ordering system at all.** The ledger is CR-01; a stock check at checkout is Phase 1A.

This also raises a client question — see [CLIENT-QUESTIONS.md](CLIENT-QUESTIONS.md) Block H.

---

## H-2 — Appointment double-booking is a race in the API, not only in the admin browser write

[ROADMAP.md §B.2](ROADMAP.md) correctly identifies `admin/components/admin/Appointments.tsx:211` as a live double-booking bug, because the browser write skips `assertSlotBookable()`. Migrating that call to the API is necessary but **not sufficient**.

The API path has its own time-of-check-to-time-of-use gap. [appointments.service.ts:102-118](../apps/api/src/modules/appointments/appointments.service.ts#L102-L118) does:

```ts
await this.assertSlotBookable(dto.branchId, dto.date, dto.time);   // SELECT
...
.insert({ ... })                                                    // separate INSERT
```

`assertSlotBookable` → `takenTimes()` is a plain `SELECT` ([appointments.service.ts:280-309](../apps/api/src/modules/appointments/appointments.service.ts#L280-L309)). Two concurrent bookings for the same slot both read "free" and both insert. There is **no unique constraint on `appointments (branch_id, scheduled_at)`** in any migration — grepping the migration set for a unique index on appointments returns nothing.

**Fix:** add a partial unique index and let the database be the arbiter:

```sql
CREATE UNIQUE INDEX appointments_branch_slot_uidx
  ON appointments (branch_id, scheduled_at)
  WHERE status <> 'cancelled';
```

Then map the `23505` unique violation to the existing 409 `ConflictException`. Note this index encodes **capacity = 1 per slot**, which is exactly the assumption question A6 asks the client. If they answer "multiple patients at once", the index needs a capacity column instead — so build it after A6 comes back, or build it now and accept a follow-up migration.

The Phase I exit criterion in [TEAM-PLAN.md](TEAM-PLAN.md) — *"an admin can no longer double-book an appointment slot (write a test for exactly this)"* — is not met by the API migration alone. A concurrent-booking test will still fail.

---

## H-3 — The customer booking path never reaches the API and has no validation at all

*Added 2026-08-07, found while enumerating call sites for the [API migration plan](API-MIGRATION-PLAN.md).*

`apps/web/app/appointments/page.jsx:359` books appointments by calling `createAppointment()` from `@optex/db` — a query helper that does a raw INSERT ([`packages/db/src/queries/appointments.ts:29-48`](../packages/db/src/queries/appointments.ts#L29-L48)):

```ts
const { data, error } = await db
  .from('appointments')
  .insert({ branch_id, type, scheduled_at, customer_id, ... })
```

**There is no validation of any kind.** No branch-hours check, no slot-grid alignment, no double-booking guard, no `assertSlotBookable()`. A customer can book a slot that is already taken, outside opening hours, on a day the branch is closed, or at 3am — by using the booking page normally.

This is worse than H-2 and worse than the admin bypass in [ROADMAP §B.2](ROADMAP.md):

| Path | Validation |
| --- | --- |
| API (`POST /api/appointments`) | Full — with a TOCTOU race (H-2) |
| Admin panel reschedule | Skips `assertSlotBookable()` — documented |
| **Customer booking page** | **None. Never calls the API.** |

**Why every prior document missed it:** the existing audits counted browser writes by grepping `.from(`. This write is wrapped in a helper function, so it does not match. Three more cart writes (`addCartItem`, `updateCartItemQuantity`, `removeCartItem`) hide the same way. **The real browser-write count is 17, not 13** — see [API-MIGRATION-PLAN §2.1](API-MIGRATION-PLAN.md).

The helper's own comment documents a second problem: it notes that RLS *"also allows anon inserts when customer_id is null (guest bookings)"*. The client has since decided [an account is required](CLIENT-ANSWERS.md) for appointments, so that policy must be dropped too.

**Fix:** route the page through `api.appointments.create()` (the endpoint exists and is correct), then **delete `createAppointment` from `packages/db`** so it cannot be called again. Audit existing appointments for out-of-hours and double-booked rows before migrating — some almost certainly exist.

---

## M-1 — `adminLinkPayment` credits an order with no amount and no state check

[payments.service.ts:732-812](../apps/api/src/modules/payments/payments.service.ts#L732-L812) sets the transaction to `MATCHED` and calls `creditOrder()` without comparing `tx.amount_kes` to `order.total_kes`, and without calling `assertPayable()`. Every other credit path in the file verifies the amount first; this one does not.

It is admin-only, so this is an operator-error risk rather than an attack, but it is the single tool most likely to be used under pressure during a reconciliation incident — precisely when a KES 100 transaction gets linked to a KES 10,000 order. Surface the mismatch and require an explicit override flag.

---

## M-2 — Money constants duplicated across SQL and TypeScript

The cart total and the order total are computed by **two independent implementations that must agree by hand**:

| Constant | TypeScript | SQL |
| --- | --- | --- |
| VAT rate `0.16` | [cart.service.ts:16](../apps/api/src/modules/cart/cart.service.ts#L16) | inline in `place_order` |
| Shipping `300` KES | *(not present — cart excludes shipping)* | inline in `place_order` |

The `place_order` header comment says the maths "mirrors `OrdersService.checkout` / `CartService` **EXACTLY**" — which is an instruction to a future maintainer to keep two implementations in sync manually. Kenya's VAT rate is legislated and will change. When it does, one of these two will be missed, and the failure is silent and financial.

Separately, the flat 300 KES contradicts the delivery model the client described (Wells Fargo pickup stations, free above a threshold within Nairobi) — see [ROADMAP.md §A.3 C-3](ROADMAP.md). This constant is going to be replaced by a rules engine regardless; do the deduplication as part of that work rather than twice.

---

## M-3 — COD is still live in the checkout RPC

`place_order` branches on `p_payment_method = 'cod'` to set the order straight to `received`, skipping payment entirely ([0008_api_hardening.sql:204-206](../Backend/supabase/migrations/0008_api_hardening.sql#L204-L206)). The client has stated they are not offering Cash on Delivery.

Removing it from the checkout UI is already on the plan ([ROADMAP.md §E.2](ROADMAP.md)), but a UI-only removal leaves a reachable API path that creates a fulfillable, unpaid order. Gate it server-side too — reject `cod` in the payment-method DTO until the client asks for it back.

---

## What I checked and found sound

Worth stating explicitly, because it is the majority of the code:

- **Authorization.** `RolesGuard` ([roles.guard.ts](../apps/api/src/auth/roles.guard.ts)) and `SupabaseAuthGuard` are correct; guard order in `app.module.ts:96-97` is throttle → authenticate → authorize. The `app_metadata` vs `user_metadata` escalation fix is genuinely closed across all three checkpoints.
- **Ownership enforcement.** Every customer-scoped service resolves `customers.id` from the JWT `auth_user_id` before reading or writing. `resolveOwnedOrder` ([payments.service.ts:821-851](../apps/api/src/modules/payments/payments.service.ts#L821-L851)) is the model.
- **Pesapal IPN.** Correctly treats the posted body as untrusted and re-queries for the authoritative status. This is the pattern C-1 needs.
- **Idempotency.** `creditOrder`'s guarded update (`.neq('payment_status','paid')` then check `data.length`) is a correct compare-and-swap that also prevents duplicate confirmation SMS.
- **`place_order` transaction discipline.** The `FOR UPDATE` on `cart_items` before aggregating (working around Postgres disallowing `FOR UPDATE` with aggregates) is a real fix for a real race, correctly done.
- **Prescriptions.** Private bucket, per-customer namespacing, ownership-checked 60-second signed URLs. Appropriate for health data under the DPA 2019.
- **CORS.** Fails loudly at startup on wildcard-plus-credentials rather than silently misconfiguring.
- **Timezone handling.** Africa/Nairobi fixed +03:00 is correct (Kenya has no DST) and consistently applied.

---

## Recommended order

1. **C-1, C-2** — same file, same afternoon. C-1 is exploitable today by any customer and the fix is to copy the Pesapal pattern.
2. **C-3** — one migration: `REVOKE` plus a `current_customer_id()` rewrite.
3. **H-1** — needs a client answer first (Block H). Ship the read-only part now: stock check at checkout, out-of-stock state on the PDP.
4. **H-3 then H-2** — in that order. H-3 is a one-line swap to an endpoint that already exists and closes a total validation bypass; H-2 is the migration plus a `23505` handler that closes the remaining race. Fixing H-2 alone leaves the customer path unvalidated, which is the larger hole.
5. **M-1, M-3** — small, do them alongside.
6. **M-2** — fold into the shipping-rules work; don't do it twice.

None of C-1, C-2, C-3, or H-2 depends on client input. All four can start immediately.
