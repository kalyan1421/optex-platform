# Sprint Plan — Sprint 2

**Dates:** Thu 2026-08-13 → Wed 2026-08-26 (10 working days) · **Team:** Kalyan, solo
**Follows:** [SPRINT-01](SPRINT-01.md), completed 2026-08-12 — all five P0 items closed.
**Backlog:** [TASKS.md](../TASKS.md)

---

## Sprint Goal

> **Make the account the front door: a shopper can fill a cart as a guest, sign in without losing it, and then transact — checkout, booking and orders all behind one consistent gate.**

## Scope, as directed

**In:** functional and backend work.
**Out this sprint:** ads, SEO / the rest of Wave 4, and any missing payment integration. Design is explicitly **not** a blocker — UI is built against existing patterns and reviewed later.

### The policy this sprint implements

*A customer must be signed in to place an order, book an appointment, or check out.*

Current state, verified against the running stack rather than the docs:

| Flow | API | Storefront | Gap |
| --- | --- | --- | --- |
| Checkout | Orders require `customer_id` (NOT NULL since `0006`) | Redirects **on mount** | None |
| Appointments | `POST /appointments` returns **401** without a token | Redirects **on submit** | Customer fills the entire form, then gets bounced |
| Orders | Owned by `customers.id` from the JWT | — | None |

So the gate largely exists. What does not exist is the thing the policy *creates*: if you must sign in to check out, and signing in throws away the cart you just filled, the policy costs you the order. That is this sprint's P0.

`appointments.customer_id` is also still nullable, and [FEATURE-STATUS §4](FEATURE-STATUS.md) still advertises "Booking (incl. guest)" — the schema and the docs both trail the API.

## Capacity

| Person | Available days | Build capacity | Notes |
| --- | --- | --- | --- |
| Kalyan | 10 | **8 pts** | ~2 days to client comms, credentials and review. 1 pt ≈ 1 focused engineer-day |

**Planned capacity: 8 pts · Sprint load: 5.5 pts · 69% committed.**

The buffer is deliberate: Sprint 1 spent roughly a third of its time on defects found *while* fixing other defects — a broken test harness, a circular container bootstrap, four India references in a Kenyan storefront. That pattern is the norm here, not the exception.

## Sprint Backlog

| Pri | # | Item | Est | Dependencies |
| --- | --- | --- | --- | --- |
| **P0** | 1 | **Guest-cart merge at sign-in** — push local lines through `api.cart.addItem` before applying the server cart, then reconcile. Must be idempotent: a double-fire cannot double the quantities | 3 | None |
| **P0** | 2 | **Gate `/appointments` on mount, not on submit** — match checkout, so the customer is sent to sign in before filling the form, and returned to it afterwards | 0.5 | None |
| **P0** | 3 | **Migration `0011`: `appointments.customer_id` NOT NULL** — the API already refuses guest bookings; the schema should agree. Backfill or reject orphans first | 1 | #2 |
| **P1** | 4 | **Cart empty state** — no treatment exists, and it is now reachable from the merge path | 1 | #1 |
| **P2** | 5 | **Customer-initiated order cancel** — no endpoint; `cancelled` is admin-only | 2 | None |
| | | **Committed (P0+P1)** | **5.5** | |

### Explicitly deferred

| Deferred | Why |
| --- | --- |
| Rest of Wave 4 — PDP SSR, sitemap, robots, JSON-LD | SEO, out of scope this sprint. `/shop` and G-7 already landed |
| M-Pesa waiting state, invoice PDF | Payment-adjacent; out per direction |
| All Figma work | Design is not a blocker. UI follows existing patterns; review later |
| Wave 3 (web account/cart reads → API) | 4 pts of refactor with no user-visible change. Real, but it loses to shipping the account flows this sprint |
| Saved addresses, reorder | Account depth. Sprint 3 candidates once cancel lands |
| Verified-purchase check on reviews | Needs a product decision — gate reviews, or drop the claim — before it can be built |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | **Cart merge double-counts** on a re-fired effect or a slow network | High | Customer is charged for two of everything | Merge exactly once per sign-in transition, guarded by a ref; assert quantities in a test, not by eye |
| R2 | **Orphan appointment rows** block the NOT NULL migration | Medium | `0011` fails on a real database | Count nulls before writing the migration; decide backfill vs delete with the data in front of me |
| R3 | Cancel needs a refund rule for paid orders | Medium | Half-built feature | P2 for exactly this reason. If it starts, scope to unpaid orders only |
| R4 | Another latent defect surfaces mid-sprint | **High** — it happened every time in Sprint 1 | Scope slips | The 31% buffer. Cut #5 first, then #4 |

## Definition of Done

- [ ] CI green — typecheck, build, format, 10 API e2e, 5 smoke
- [ ] New behaviour covered by a test that fails without the fix
- [ ] Verified against the running stack, not by inspection
- [ ] TASKS.md and FEATURE-STATUS.md updated in the same commit

## Key dates

| Date | Event |
| --- | --- |
| Thu 08-13 | Sprint start · #1 begins |
| Wed 08-19 | Mid-sprint: P0 complete |
| Wed 08-26 | Sprint end |
