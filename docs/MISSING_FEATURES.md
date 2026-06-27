# OPTEX — Missing Features & Gap Analysis
**Last audited:** 2026-06-09  
**Audited against:** OPTEX-SOW-2025-001-KE v3.0 + Change Request CR-01

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented (real DB, real logic) |
| 🟡 | Stub / placeholder (UI exists, data is hardcoded or fake) |
| ❌ | Missing entirely (no file, no route, no logic) |

---

## Phase 1A — Original SOW (launch-blocking gaps)

### 🔴 Group 1: Security & DB Fixes (must ship before any payment work)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| S-1 | `orders` INSERT RLS lockdown | ❌ | Customer can self-set `status='delivered'` + `payment_status='paid'` — critical exploit |
| S-2 | `current_customer_id()` SECURITY DEFINER | ❌ | Missing — fragile if customers SELECT policy ever tightens |
| S-3 | `order_number` column DEFAULT | ❌ | NOT NULL but no default — any INSERT without it crashes |
| S-4 | Nullable `orders.customer_id` + `prescriptions.customer_id` | ❌ | Should be NOT NULL — RLS lockout risk |
| S-5 | `formatKes(NaN)` guard in `@optex/ui` | ❌ | Renders "KES NaN" in cart/checkout when price is undefined |
| S-6 | Atomic cart clear after order | ❌ | Checkout clears cart item-by-item in a loop — partial failure leaves ghost items |

---

### 🔴 Group 2: Payment Infrastructure (hardest, launch-blocking)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P-1 | M-Pesa Daraja STK Push API call | ❌ | No `/api/payments/mpesa/initiate` route exists — selecting M-Pesa at checkout just saves `payment_method='mpesa'` with no actual push |
| P-2 | M-Pesa callback webhook handler | ❌ | No `/api/webhooks/mpesa` route — Daraja has nowhere to POST the payment result |
| P-3 | Pesapal redirect URL + IPN webhook | ❌ | No `/api/payments/pesapal/initiate` or `/api/webhooks/pesapal` — Pesapal payments non-functional |
| P-4 | M-Pesa transaction status polling | ❌ | No mechanism to query Daraja for STK Push result if callback is delayed |
| P-5 | Payment pending / confirmation page | ❌ | After checkout, user is redirected to `/profile?order=placed` — no dedicated confirmation screen with order summary |
| P-6 | Admin Payments page — real data | 🟡 | `Payments.tsx` exists with hardcoded arrays; no queries to `mpesa_transactions` / `pesapal_transactions` |

---

### 🔴 Group 3: Missing Web Storefront Pages

| # | Page/Feature | Status | Notes |
|---|-------------|--------|-------|
| W-1 | `/appointments` — booking wizard | ❌ | Directory doesn't exist; `createAppointment()` query is in `@optex/db` but never called from web |
| W-2 | `/orders/[id]/tracking` — order tracking | ❌ | No tracking page; orders exist in DB but customer can't track status |
| W-3 | `/search` — product search | ❌ | No search page; `products.search_tsv` GIN index exists unused; no search bar in header |
| W-4 | `/branch-locator` — Google Maps | ❌ | Not built; Contact page has a static iframe but no DB-driven pins |
| W-5 | Customer review form on PDP | ❌ | Reviews exist in DB and admin panel; customer has no way to submit a review |
| W-6 | Order confirmation / thank-you page | ❌ | Checkout redirects to profile — no post-purchase summary page |

---

### 🟡 Group 4: Admin Panel Stubs (exist but hardcoded)

| # | Admin Page | Status | Notes |
|---|-----------|--------|-------|
| A-1 | Analytics page | 🟡 | Entirely hardcoded arrays — zero DB calls; charts show static demo data |
| A-2 | Payments page | 🟡 | Hardcoded M-Pesa/Pesapal/COD rows; "Reconcile" button is `setTimeout` fake |
| A-3 | Prescriptions page | 🟡 | Hardcoded 5-row fixture; no Supabase Storage viewer; no DB query |
| A-4 | Dashboard revenue chart | 🟡 | KPI cards are real; bar chart uses hardcoded `salesData7D/30D/90D` arrays |

---

### 🔴 Group 5: Communications Integrations

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| C-1 | Africa's Talking SMS — order confirmation | ❌ | Referenced throughout SOW; no API client, no Supabase Edge Function or route |
| C-2 | Africa's Talking SMS — appointment reminder (24h + 1h) | ❌ | Same — no scheduled job / trigger |
| C-3 | Contact form → real email (Resend / SES) | 🟡 | Submit handler does `setTimeout` + fake success; never sends anything |
| C-4 | Order confirmation email | ❌ | No Resend/SES integration; order creation sends nothing |

---

### 🔴 Group 6: SEO & Content Pages

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| E-1 | JSON-LD: LocalBusiness schema | ❌ | Not present in any layout |
| E-2 | JSON-LD: MedicalOrganization schema | ❌ | Not present |
| E-3 | JSON-LD: FAQ schema | ❌ | Not present |
| E-4 | JSON-LD: Product schema | ❌ | PDP uses no structured data |
| E-5 | `/category/[slug]` landing pages | ❌ | No category route; shop page handles all; no SEO-separate category pages |
| E-6 | Trust pages (warranty, returns, delivery, privacy) | ❌ | None of these pages exist |

---

### 🔴 Group 7: `@optex/db` Package Fixes

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| D-1 | `textSearch` type cast broken | ❌ | `'tsquery' as 'websearch'` — multi-word search silently fails |
| D-2 | `createOrder` missing `discount_kes` | ❌ | Promo discount amount never stored on the order record |
| D-3 | `getOrCreateCart` race condition | ❌ | Concurrent cart creation for new customers → unique-constraint crash |
| D-4 | `product-image.js` no fallback on missing env var | ❌ | Returns broken relative URL if `NEXT_PUBLIC_SUPABASE_URL` unset |
| D-5 | Admin `formatKes` duplicates in Dashboard/Orders | 🟡 | Local copies drift from `@optex/ui`; should import shared version |

---

## Phase 1B — CR-01 Features (post-launch)

> These ship after Phase 1A go-live. Sequenced per critical-path dependency order.

### CR-01.2 — Multi-Role Admin / RBAC *(foundational — blocks all other CR-01 modules)*

| Feature | Status |
|---------|--------|
| 7 roles: Super Admin, Branch Manager, Branch Staff, Inventory Manager, Accountant, Marketing, Doctor | ❌ |
| Granular permission matrix per module (view/create/edit/delete) | ❌ |
| Permission middleware on every route | ❌ |
| Branch-scoped data filtering | ❌ |
| User management screen (create user, assign role + branch) | ❌ |
| Admin action audit log | ❌ |
| 2FA for Super Admin, Accountant, Doctor (TOTP) | ❌ |

### CR-01.1 — Full Inventory Management *(requires RBAC)*

| Feature | Status |
|---------|--------|
| Supplier / vendor master data | ❌ |
| Purchase Order module (create, approve, track) | ❌ |
| Goods Received Note (GRN) against POs | ❌ |
| Real-time stock ledger per SKU per branch (event-sourced) | ❌ |
| Inter-branch stock transfer workflow | ❌ |
| Stock adjustments with reason codes | ❌ |
| Reorder point + quantity alerts | ❌ |
| Stock valuation (FIFO / weighted average) | ❌ |
| Dead-stock / aging inventory report | ❌ |
| Physical stock count + reconciliation | ❌ |

### CR-01.5 — Doctor Consultation Module *(requires RBAC + Phase 1A appointments)*

| Feature | Status |
|---------|--------|
| Doctor master data (qualifications, photo, bio) | ❌ |
| Doctor-to-branch assignment + availability schedule | ❌ |
| Doctor leave / blocked-dates calendar | ❌ |
| Consultation types with durations + fees | ❌ |
| Real-time slot availability engine | ❌ |
| 5-step customer booking wizard | ❌ |
| In-clinic consultation queue | ❌ |
| Consultation notes + e-prescription PDF | ❌ |
| Patient medical profile + prescription timeline | ❌ |
| Consultation fee payment (M-Pesa / Pesapal) | ❌ |
| Kenya DPA 2019 patient consent flow | ❌ |
| Doctor utilization / no-show / revenue reports | ❌ |

### CR-01.4 — Product Analytics & Reporting *(requires Inventory ledger)*

| Feature | Status |
|---------|--------|
| Cost-price field on SKUs + data migration | ❌ |
| Days-on-shelf, sell-through rate, sales velocity | ❌ |
| Fast/slow-movers, dead-stock, margin analysis | ❌ |
| Stock-to-sales ratio, seasonal trends, return rate | ❌ |
| CSV/Excel export on all reports | ❌ |
| Scheduled email digests | ❌ |

### CR-01.3 — Branch P&L & Investment Analysis *(parallel-safe)*

| Feature | Status |
|---------|--------|
| Branch capex entry | ❌ |
| Monthly opex tracking per branch | ❌ |
| Branch P&L statement (revenue − opex by month) | ❌ |
| ROI + break-even analysis per branch | ❌ |
| Branch comparison dashboard | ❌ |
| Scheduled monthly snapshot job | ❌ |

---

## What IS Complete ✅

### Web Storefront
- Home (Hero, Featured Collection, Trending Now, Promotional, FaceShape, WhyOptex, Testimonials)
- Shop page (category + brand filters, sort, 100-product fetch)
- Product Detail page (images, price, add to cart)
- Cart (Supabase-backed, promo code validation, VAT calc)
- Checkout (3-step UI, COD/M-Pesa/Pesapal selector, order created in DB — **payments not fired**)
- Login / Signup (Supabase Auth email+password)
- Forgot Password / Reset Password (full email flow)
- Profile (order history, prescription table from DB)
- Contact page (form UI — **email not sent**)

### Admin Panel
- Login + middleware auth gate (super_admin only)
- Dashboard (live KPIs + recent orders + top products)
- Products (full CRUD + image upload dialogs wired)
- Orders (status workflow wired to DB)
- Customers (real DB, computed order totals)
- Appointments (real DB, confirm/cancel/reschedule)
- Inventory (real DB, inline stock edit, composite PK)
- Reviews (real DB, approve/flag/reply)
- Promotions (real DB, promo codes + banners)
- Branches (real DB, save persists to Supabase)

### Backend / Packages
- Supabase schema: 16 tables, 5 enums, RLS on all tables, 5 migrations
- `@optex/db`: full query layer (products, orders, cart, branches, appointments, admin, auth)
- `@optex/ui`: Button, Card, Input, Label, Badge, Separator, `formatKes`, `cn`
- `@optex/config`: Tailwind preset, brand tokens, Montserrat font

---

## Priority Order for Phase 1A Completion

```
Week A  → Group 1: Security fixes (S-1 through S-6)
           Group 7: DB package fixes (D-1 through D-5)

Week B  → Group 2: Payment infrastructure (P-1 through P-6)
           Group 5: Communications (C-1 through C-4) — AT SMS + Resend

Week C  → Group 3: Missing web pages (W-1 through W-6)
           Group 4: Admin stubs wired (A-1 through A-4)

Week D  → Group 6: SEO + content pages (E-1 through E-6)
           Performance, Core Web Vitals, UAT

Week E  → Go-live: Vercel + Cloudflare DNS, training, handover
```

**Total remaining Phase 1A work: ~35–40 dev-days**  
**Total Phase 1B (CR-01) work: ~44–54 dev-days** (per CR-01 change request)
