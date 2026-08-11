-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_rls_write_lockdown.sql
--
-- Closes the direct-write bypass that survived the Wave 1 API migration.
--
-- CONTEXT
--   Wave 1 moved all 17 browser write sites in apps/web and apps/admin onto the
--   NestJS API, which enforces the business rules (assertSlotBookable, review
--   moderation, cart validation). But moving the *callers* does not close the
--   *bypass*: the anon key ships in the browser bundle by design, so anyone with
--   it and a customer login could still POST straight to PostgREST and skip
--   every rule. Verified against the local stack on 2026-08-07:
--
--     POST /rest/v1/appointments     -> 201  (authenticated AND anonymous)
--     POST /rest/v1/product_reviews  -> 201  with status='approved' self-set,
--                                            publicly visible, and it moved the
--                                            product's aggregate rating
--     POST /rest/v1/cart_items       -> 201  arbitrary quantity (9999)
--
--   Admin-owned tables (products, branches, promo_codes) were already correctly
--   restricted to super_admin and are untouched here.
--
-- WHAT THIS CHANGES
--   Writes to these tables become service-role-only — i.e. the API. RLS stops
--   being the enforcement layer for them and becomes defence-in-depth, which is
--   what CLAUDE.md already claims it is. Customer READS are preserved exactly.
--
--   This also drops the anonymous appointment INSERT. The client has confirmed
--   an account is required to book (CLIENT-ANSWERS B4), so guest booking via
--   RLS is contrary to the agreed model. `contact_name`/`contact_phone` remain
--   on the table for admin-created walk-in bookings.
--
-- SAFETY
--   The service-role client used by apps/api bypasses RLS entirely, so no API
--   behaviour changes. Existing rows are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ─── appointments ────────────────────────────────────────────────────────────
-- Booking, rescheduling and cancelling all go through the API, which validates
-- branch opening hours, slot-grid alignment and double-booking. Direct writes
-- skipped all three.
drop policy if exists "anyone can book appt"       on appointments;
drop policy if exists "customer updates own appt"  on appointments;
drop policy if exists "customer cancels own appt"  on appointments;

-- ─── product_reviews ─────────────────────────────────────────────────────────
-- A direct insert could set status='approved' and self-publish, bypassing the
-- moderation queue and the one-review-per-product guard — and it counted toward
-- the public aggregate rating. (Note: there is no verified-purchase check on
-- either path; ReviewsService.createForProduct does not check that the reviewer
-- bought the product, and the schema has no verified_purchase column.)
drop policy if exists "customer submits own review" on product_reviews;

-- ─── carts / cart_items ──────────────────────────────────────────────────────
-- Replace the permissive ALL policies with SELECT-only, so a customer can still
-- read their own cart but cannot write lines or quantities directly. CartService
-- owns quantity bounds, the line-merge rule and product availability.
drop policy if exists "cart self only"       on carts;
drop policy if exists "cart items self only" on cart_items;

create policy "cart read self only"
  on carts for select
  using (customer_id = current_customer_id());

create policy "cart items read self only"
  on cart_items for select
  using (
    exists (
      select 1 from carts c
      where c.id = cart_items.cart_id
        and c.customer_id = current_customer_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Note: the `admin manages appts` and `admin moderates reviews` ALL policies are
-- deliberately retained. They are gated on is_super_admin() (app_metadata only,
-- per migration 0007) and are the break-glass path if the API is unavailable.
-- ─────────────────────────────────────────────────────────────────────────────
