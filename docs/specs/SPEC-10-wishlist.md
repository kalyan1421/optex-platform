# SPEC-10 — Wishlist / Favourites

**Date:** 2026-08-13 · **Status:** Unblocked, no client dependency · **Owner:** TBD
**Source:** [FEATURE-STATUS §1](../FEATURE-STATUS.md)

> **Prior art exists.** `archive/venky-optex` has a full reference implementation — `context/WishlistContext.js`, `components/WishlistButton.jsx`, `app/wishlist/page.jsx`, `packages/db/src/queries/wishlist.ts`, and a `wishlists` table in `Backend/supabase/migrations/0009_storefront_features.sql` (schema near-identical to R1 below: same composite key, same RLS shape). **Not directly reusable** — it writes to Supabase directly from the browser (`createBrowserSupabase()`), which is exactly the pattern this codebase's Wave 1 API migration eliminated (see [CLAUDE.md](../../CLAUDE.md)); R2/R3 below route the same writes through the API instead. The UI/UX thinking is worth reading closely before building — see R5's correction below, which came directly from it.

---

## Problem Statement

There is no table, endpoint, or UI for saving a product without buying it — `grep`-confirmed zero hits for wishlist/favourite anywhere in the codebase. Eyewear is a considered, comparison-heavy purchase (frame shape, weight, price across several candidates), and today the only way to "save" a product for later is to add it to cart, which pollutes checkout intent with items the shopper has not decided on, or to rely on memory across a session that does not persist.

## Goals

1. **A signed-in customer can save or unsave a product in one click**, from the shop grid, home carousels, or the product page, and the state persists across sessions and devices.
2. **A dedicated wishlist page** lists everything saved, with a fast path back into the cart.
3. **The feature never breaks** when a saved product is later discontinued or goes out of stock — it degrades gracefully, not with an error.
4. **State is instantly visible everywhere a product appears** — a heart filled on the shop grid must match the same product's heart on its own detail page, without a page reload.

## Non-Goals

| Not doing                                                                    | Why                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest wishlist with merge-on-login (mirroring the cart's guest-cart pattern) | Cart's guest+merge exists because an abandoned cart at checkout is lost revenue — worth the real complexity it cost this session (localStorage, merge races, first-mount wipe bugs). An unsaved wishlist item costs a shopper one repeat click, not a lost sale. Requiring login here is a smaller, more defensible v1; revisit only if data shows meaningful drop-off at the login wall (see Open Questions). |
| Price-drop / back-in-stock alerts on wishlisted items                        | Real feature, but a distinct one — notification infrastructure, a cron sweep, `NotificationsModule` wiring. Building it speculatively now, before the base wishlist even has users, is exactly the kind of premature machinery this codebase's conventions (SPEC-05, SPEC-06) avoid. P2.                                                                                                                       |
| Sharing a wishlist (gift-registry style)                                     | No evidence of demand for an optician storefront; not in the SOW.                                                                                                                                                                                                                                                                                                                                              |
| Wishlist analytics (most-wishlisted products, conversion-from-wishlist rate) | Real product value eventually, but depends on the base feature existing first and accumulating data. P2.                                                                                                                                                                                                                                                                                                       |

## User Stories

### Shopper

- As a signed-in shopper, I want to save a product I'm considering with one click from the shop grid, so that I don't lose track of it while comparing others.
- As a shopper, I want the same product to show as saved whether I'm looking at the grid, a home carousel, or its own page, so the state feels consistent rather than per-screen.
- As a shopper, I want a page listing everything I've saved, so that I can come back and decide later.
- As a shopper ready to buy, I want to add a saved item straight to my cart from the wishlist page, so I don't have to re-find the product.
- As a signed-out visitor, I want to be told to log in when I try to save something, so my intent isn't silently dropped.

### Edge cases

- A wishlisted product is discontinued or deleted — the wishlist page shows it as unavailable with a way to remove it, not a broken row or a 500.
- A wishlisted product goes out of stock — visible on the wishlist page, does not block viewing or removing it.
- A signed-out visitor clicks the heart on a product card — must not silently no-op or wait for a failed API call; see R5.
- The same product is saved from two tabs in quick succession — the second write is a harmless no-op, not a duplicate row or an error surfaced to the user.

## Requirements

### P0 — Must have

**R1. `wishlist_items` table.**

- [ ] `wishlist_items(customer_id references customers(id) on delete cascade, product_id references products(id) on delete cascade, created_at, primary key (customer_id, product_id))` — a plain join table; no need for a separate parent "wishlist" entity per customer
- [ ] RLS: customer may `SELECT` own rows only, matching the read-scoped/write-via-API posture every other customer-owned table in this schema already has (`0009_rls_write_lockdown.sql`) — no direct-insert policy

**R2. API surface, mirroring `cart.controller.ts`'s conventions.**

- [ ] `GET /wishlist` — the caller's saved product ids (and enough product data to render the list page in one call)
- [ ] `POST /wishlist/:productId` — idempotent add; saving an already-saved product is a no-op, not a conflict
- [ ] `DELETE /wishlist/:productId` — idempotent remove
- [ ] All three are authed and scoped to the caller's `customers.id`, resolved from the JWT — same ownership pattern as `CancellationService.resolveOwnedOrder` and `CartService`

**R3. `WishlistContext`, mirroring `CartContext`'s architecture.**

- [ ] Loads the signed-in customer's saved product-id set once, exposes a `toggle(productId)` and a fast `isSaved(productId)` lookup
- [ ] Product cards and the PDP read from this single context, so state is consistent across every surface without per-component fetching

**R4. A save/heart control on every product-card surface and the PDP.**

- [ ] Shop grid (`ShopBrowser.jsx`), home carousels (`FeaturedProducts.jsx`, `TrendingNow.jsx`, `FeaturedCollection.jsx`), search results, and the product page all carry the control
- [ ] Filled/active state reflects `WishlistContext`, not a per-card fetch

**R5. Signed-out visitors are gated on the save click, not on page arrival.**

Unlike appointments (whose whole page requires an account, so gating on arrival is correct there — `e2e/appointments-gate.spec.ts`), a shop grid or PDP must stay browsable by anyone. Gating on arrival here would block anonymous shopping entirely, which is not the goal — only the save action needs an account.

- [ ] Given a signed-out visitor clicks save, they are redirected to login **with a return path back to the page they were on** (not the homepage) — `WishlistContext.toggle()` reports "needs login" as a result rather than silently no-opping or throwing, and the caller does the redirect
- [ ] Given they log in from that redirect, they land back where they were, not on an unrelated page

**R6. A dedicated wishlist page.**

- [ ] Lists every saved product with image, name, price, and a remove action
- [ ] Each item has an add-to-cart action
- [ ] Given a saved product no longer exists or is discontinued, it renders as unavailable with a remove action — never a broken row or a page-level error

### P1 — Should have

- **R7.** "Move to cart" as a single action from the wishlist page (add + remove in one step), for the common case of finally deciding to buy.
- **R8.** Out-of-stock indicator on wishlist items, reusing whatever availability signal [SPEC-02 R2](SPEC-02-checkout-fulfilment.md) ships — do not build a second one.
- **R9.** A wishlist count badge in `Navbar.jsx`, mirroring the existing `cartCount` badge (`Navbar.jsx:86,228-230`) exactly.

### P2 — Future considerations

- Price-drop / back-in-stock alerts (see Non-Goals).
- Wishlist sharing.
- Wishlist analytics (most-saved products, save-to-purchase conversion).

## Success Metrics

**Leading (first 30 days):**

| Metric                                                     | Success                                       | Method                               |
| ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| % of signed-in shoppers who save at least one product      | Baseline established                          | Wishlist writes / signed-in sessions |
| Wishlist page load success rate (incl. discontinued items) | No errors, ever                               | Error monitoring                     |
| Save action latency                                        | < 300ms perceived (optimistic UI via context) | Manual check                         |

**Lagging (first quarter):**

| Metric                                | Target                                               | Method                                                  |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Wishlist → cart conversion            | Baseline established, then track trend               | `POST /wishlist/:id` followed by cart add, same session |
| Repeat visits driven by wishlist page | Directional signal only — low traffic expected early | Analytics, once GA/equivalent exists                    |

## Open Questions

| #   | Question                                                                                                                                   | Owner   | Blocking?                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| Q1  | Does requiring login to save meaningfully hurt engagement, enough to justify the guest+merge complexity this spec deliberately scoped out? | Product | No — ship login-required v1; revisit with real usage data, not a guess                            |
| Q2  | Where does the wishlist page live in the nav — under `/account`, or a top-level `/wishlist`?                                               | Design  | No — either works; pick the one consistent with how `/profile` and `/orders` are already surfaced |

## Timeline Considerations

No client dependency. R1–R2 (schema + API) are a small, self-contained slice — mirrors `cart`'s existing shape closely enough that it is mostly repetition, not new design. R3–R6 (context + UI across four+ surfaces) is the bulk of the work, since the control needs to land on every product-card component — though the archived `WishlistContext`/`WishlistButton` are close enough in structure and copy to port rather than design from scratch, once the data layer is rewired to go through the API. **Estimate: P0 in full — 2-3 days** given the prior art (down from a from-scratch 3-4). R7–R9 (P1) are each small, independent fast-follows.
