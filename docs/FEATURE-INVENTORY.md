# OPTEX — Complete Feature Inventory

**Date:** 2026-08-07 · **Branch:** `development` @ `0d2233f`
**Supersedes:** [FEATURE-STATUS.md](FEATURE-STATUS.md) — same method, updated for the [client answers](CLIENT-ANSWERS.md) and the [code review](CODE-REVIEW.md).

Two things are tracked per feature, because the client asked for both:

- **Status** — ✅ Done · 🟡 Partial · ❌ Absent · ⛔ Cancelled by client decision
- **Backend-owned** — the client's instruction was *"make perfect product that has backend, everything from backend only."* A feature is **BE ✅** only when its data **and its rules** come from the API and the database, and an admin can change its behaviour without a code deploy. **BE ❌** means something is hardcoded in code, computed in the browser, or reads the database directly from the client.

A feature can be Done and still fail the backend test. There are **31 such features**, and they are the largest single body of remaining work.

---

# Part 1 — Completed features

## 1.1 Storefront — catalogue & discovery

| Feature | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Home page | ✅ | 🟡 | Marketing sections hardcoded in JSX |
| Product listing (shop) | ✅ | ❌ | Reads Supabase from the browser |
| Product detail page | ✅ | ❌ | Browser read; 744 lines; client-rendered |
| Category landing pages | ✅ | ✅ | Only Server Component in the app — the reference pattern |
| Full-text search | ✅ | 🟡 | API endpoint exists; page reads Supabase directly |
| Related products | ✅ | ✅ | |
| Filter — category / brand / sort | ✅ | ❌ | Browser-side filtering |

## 1.2 Storefront — cart & checkout

| Feature | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Server-persisted cart | ✅ | ✅ | Survives sessions |
| Add / update / remove line items | ✅ | 🟡 | `CartContext` writes via Supabase, not the API |
| Multi-step checkout | ✅ | ✅ | **Fully on the API** — proof the pattern works end to end |
| Atomic order placement | ✅ | 🟡 | `place_order` RPC is correct, but VAT and shipping are hardcoded **inside the SQL** |
| VAT calculation | ✅ | ❌ | `0.16` hardcoded in two languages |
| Order confirmation page | ✅ | ❌ | Polls the database directly every 5s, up to 24 times |
| Promo code entry | ✅ | 🟡 | Discount recomputed in the browser; ⛔ hidden at launch |

## 1.3 Storefront — account & orders

| Feature | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Signup / login / logout | ✅ | ✅ | Supabase Auth is the correct owner of sessions |
| Forgot / reset password | ✅ | 🟡 | Supabase-native; no API equivalent (gap G-6) |
| Profile view + edit | ✅ | 🟡 | API exists; page reads Supabase |
| Order history | ✅ | 🟡 | Same |
| Multi-stage order tracking | ✅ | 🟡 | 6-stage enum; page reads Supabase |
| Prescription upload | ✅ | ✅ | Private bucket, per-customer namespacing |
| Prescription download | ✅ | ✅ | Ownership-checked 60s signed URL |
| Write a product review | ✅ | ❌ | Browser insert — skips moderation, duplicate guard, verified-purchase check |

## 1.4 Storefront — appointments & branches

| Feature | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Slot availability lookup | ✅ | 🟡 | Duration is a hardcoded constant |
| Booking | ✅ | 🟡 | Guest path must now close (account required) |
| Cancel / reschedule | ✅ | ✅ | |
| Slot validation | 🟡 | 🟡 | **Race condition** — check and insert are separate, no DB constraint |
| Confirmation SMS | ✅ | ✅ | Best-effort; never rolls back a booking |
| Reminder SMS (24h + 1h) | ✅ | ✅ | Idempotent dispatch flags |
| Branch locator (list) | ✅ | 🟡 | Page reads Supabase directly |

## 1.5 Storefront — content & trust

| Feature | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Privacy policy | ✅ | ❌ | 251 lines hardcoded; references DPA 2019 |
| Delivery policy | ✅ | ❌ | Hardcoded — and now **contradicts** the confirmed model |
| Returns policy | ✅ | ❌ | Hardcoded — and **contradicts** "no refunds" |
| Warranty policy | ✅ | ❌ | Hardcoded |
| Contact page + form | 🟡 | ❌ | **Duplicated backend** — a Next.js route *and* a Nest endpoint, two Resend integrations |

## 1.6 Admin panel — 12 pages

| Page | Status | BE | Gap to backend-owned |
| --- | --- | --- | --- |
| Dashboard | ✅ | ❌ | Reads Supabase directly |
| Products | ✅ | ❌ | 3 browser writes; `as any` cast defeats type safety |
| Orders | ✅ | ✅ | **Migrated — the reference pattern** |
| Customers | 🟡 | ✅ | Migrated; "Deactivate" disabled |
| Appointments | 🟡 | ❌ | 3 browser writes; reschedule **skips the double-booking guard** |
| Inventory | 🟡 | ✅ | Migrated — but stock is disconnected from ordering |
| Reviews | ✅ | ✅ | Migrated |
| Promotions | 🟡 | ❌ | 4 browser writes; banner endpoints exist with no UI |
| Branches | 🟡 | ❌ | Browser write skips `opening_hours` validation |
| Analytics | 🟡 | ❌ | Browser read + **hardcoded chart series** |
| Payments | ✅ | ✅ | Reconcile + link — see [CODE-REVIEW M-1](CODE-REVIEW.md) |
| Prescriptions | 🟡 | ❌ | Browser write; endpoint G-1 does not exist |

## 1.7 API, integrations, database

| Item | Status | BE | Note |
| --- | --- | --- | --- |
| 24 controllers, 78 routes, 13 modules | ✅ | ✅ | Swagger at `/api/docs`; `typecheck` clean |
| M-Pesa STK push / callback / polling | 🟡 | ✅ | **Critical defect** — see [CODE-REVIEW C-1](CODE-REVIEW.md) |
| Pesapal redirect + IPN | ✅ | ✅ | Correctly treats the IPN as untrusted |
| Africa's Talking SMS | ✅ | ✅ | |
| Resend email | ✅ | ✅ | |
| Supabase Auth / Storage / Postgres | ✅ | ✅ | |
| 16 tables, RLS on all, 8 migrations | ✅ | ✅ | |
| Typed API client (1,922 lines) | ✅ | ✅ | Covers customer *and* admin surface |
| Docker dev stack | ✅ | ✅ | |
| `LocalBusiness` + `MedicalOrganization` JSON-LD | ✅ | ✅ | |

**Completed: 51 features.** Of those, **20 are fully backend-owned.**

---

# Part 2 — Pending, Phase 1A

Ordered by whether they block launch.

## 2.1 Launch blockers

| # | Feature | Why it blocks | Spec |
| --- | --- | --- | --- |
| P-1 | **Fix M-Pesa payment forgery** | A customer can mark an order paid without paying | [SPEC-01](specs/SPEC-01-payment-integrity.md) |
| P-2 | **Fix PostgREST injection** | Unauthenticated caller can credit a stranger's order | [SPEC-01](specs/SPEC-01-payment-integrity.md) |
| P-3 | **Fix `place_order` privilege** | Any customer can order against another's cart | [SPEC-01](specs/SPEC-01-payment-integrity.md) |
| P-4 | **Stock check at checkout** | Unlimited overselling today | [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) |
| P-5 | **Out-of-stock display ("greyed out")** | Client-decided; customers cannot see availability | [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) |
| P-6 | **Reject COD server-side** | Creates fulfillable unpaid orders | [SPEC-01](specs/SPEC-01-payment-integrity.md) |
| P-7 | **Appointment slot constraint** | Two patients, one optometrist | [SPEC-04](specs/SPEC-04-appointment-scheduling.md) |
| P-8 | **Close 13 browser-side writes** | Business rules enforced nowhere | [ROADMAP Wave 1](ROADMAP.md) |
| P-9 | **CI + smoke suite** | Zero regression protection on a system taking money | [SPRINT-01](SPRINT-01.md) |
| P-10 | **Real product catalogue** | Nothing to sell | 🔴 Client — [O-6](CLIENT-ANSWERS.md) |
| P-11 | **Lens & coating configurator** | Core optician offer; storefront sells frames only | [SPEC-07](specs/SPEC-07-lens-configurator.md) · 🔴 [O-3](CLIENT-ANSWERS.md) |
| P-12 | **Free-delivery threshold rule** | Cannot compute a total | [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) · 🔴 [O-1](CLIENT-ANSWERS.md) |
| P-13 | **Policy pages matching reality** | Published returns policy contradicts "no refunds" | [SPEC-05](specs/SPEC-05-backend-owned-config.md) |

## 2.2 Contracted, not yet delivered

| # | Feature | Note | Spec |
| --- | --- | --- | --- |
| P-14 | Server-side rendering of catalogue pages | 23 client components | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-15 | `generateMetadata` on every page | Exists on 1 of 21 pages | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-16 | Server-rendered product JSON-LD | Renders after hydration — crawlers miss it | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-17 | `sitemap.xml` | Does not exist | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-18 | `robots.txt` | Does not exist | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-19 | BreadcrumbList schema | | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-20 | Core Web Vitals tuning | Client rendering is the root cause | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-21 | GA4 / analytics | **No analytics of any kind.** SEO deliverable is unmeasurable without it | [SPEC-03](specs/SPEC-03-storefront-seo-render.md) |
| P-22 | Google Maps on branch locator | **0 of 27** branches have coordinates | 🔴 Client D1/D2 |
| P-23 | WhatsApp chat | In the SOW, zero references in the repo | 🔴 Client D10 |

## 2.3 Newly required by the client's answers

| # | Feature | Source | Spec |
| --- | --- | --- | --- |
| P-24 | **Customer order cancellation with admin approval** | B5 | [SPEC-06](specs/SPEC-06-order-lifecycle.md) |
| P-25 | **Close the guest appointment path** | B4 — account now required | [SPEC-06](specs/SPEC-06-order-lifecycle.md) |
| P-26 | **Admin-editable delivery charge** | H4 | [SPEC-05](specs/SPEC-05-backend-owned-config.md) |
| P-27 | **Admin-editable appointment rules** (duration, capacity, break, hours) | A6 delegated to us | [SPEC-04](specs/SPEC-04-appointment-scheduling.md) |
| P-28 | **Reversed-payment visibility in admin** | H5 | [SPEC-01](specs/SPEC-01-payment-integrity.md) |
| P-29 | **`products.cost_price` column** | Margin reporting has nowhere to read from | [SPEC-08](specs/SPEC-08-cr01-phase-1b.md) |

## 2.4 Product gaps — real, unblocked, unscheduled

| # | Feature | Note |
| --- | --- | --- |
| P-30 | Filter — price range | No state variable exists |
| P-31 | Filter — frame shape | **Column exists, unused by the UI** |
| P-32 | Filter — gender | **Column exists, unused** |
| P-33 | Filter — frame material | **Column exists, unused** |
| P-34 | Search autocomplete | No debounce or typeahead anywhere |
| P-35 | Wishlist / favourites | No table, endpoint or UI |
| P-36 | Product comparison | |
| P-37 | Reorder from order history | |
| P-38 | Saved addresses | Stored per order, not per customer |
| P-39 | Invoice / receipt download | Also the natural insertion point for eTIMS |
| P-40 | FAQ page + FAQPage schema | High-yield for local retail search |
| P-41 | Admin "Deactivate customer" | Button disabled |
| P-42 | Admin promo-banner UI | **Endpoints exist, no UI** — free feature |
| P-43 | Admin analytics category chart | Hardcoded fixture |

**P-31 to P-33 are UI-only** — the database columns are already populated and simply unread. The cheapest real features on this list.

## 2.5 Cancelled by client decision

| Feature | Decision |
| --- | --- |
| ⛔ Cash on Delivery | Not offering |
| ⛔ Discounts / promotions at launch | None — engine retained, UI hidden |
| ⛔ Returns / refunds flow | No refunds — policy page only |
| ⛔ Guest checkout | Account required |
| ⛔ Per-branch stock allocation | Single central pool |

## 2.6 Out of scope by contract

| Feature | Phase |
| --- | --- |
| Virtual Try-On | Phase 3 — **but advertised on the homepage today** |
| Flutter mobile app | Phase 2 — API already built to serve it |
| eTIMS / KRA e-invoicing | **CR-02** — client says required; not in the signed SOW |

---

# Part 3 — Pending, CR-01 Phase 1B

Requirements now answered ([CLIENT-ANSWERS §4](CLIENT-ANSWERS.md)). **Not started — commercial sign-off outstanding.** Full breakdown in [SPEC-08](specs/SPEC-08-cr01-phase-1b.md).

| Area | Client decision | Scope signal |
| --- | --- | --- |
| **Inventory ledger** | Transfers ✅ · GRN ✅ · Adjustments w/ reason codes ✅ · Supplier master ✅ · Dead-stock ✅ · Physical count ✅ · **FIFO** · **per-frame serial** · POs ❌ | **Largest item.** Per-frame serial + FIFO roughly doubles it vs SKU-level |
| **RBAC** | Branch Manager scoped to own branch ✅ · 2FA on Super Admin · audit log 3 months · user list later | Foundational — everything else reads from it. Role list needs confirming ([O-5](CLIENT-ANSWERS.md)) |
| **Branch reporting** | capex N/A · opex N/A · entered by Admin · online revenue by **customer choice** · report: **Ranking** | **Much smaller than titled** — revenue ranking, not P&L ([O-8](CLIENT-ANSWERS.md)) |
| **Product analysis** | Cost price ✅ · days-on-shelf from **GRN date** · digests ✅ · report: **Margin** | Depends on the ledger *and* the real catalogue |
| **Doctor consultation** | Not answered in this round | Still blocked |

**New tables required:** `roles`, `permissions`, `audit_log`, `suppliers`, `grn`, `stock_ledger`, `stock_transfers`, `stock_serials`, `stock_counts`, `doctors`, `doctor_availability`, `consultations`. Plus `products.cost_price`.

---

# Part 4 — The backend-ownership gap register

*This is the "everything from the backend only" instruction, made concrete.* Every row is something a customer sees whose behaviour an admin cannot currently change.

## 4.1 Hardcoded values that must become configuration

| # | What | Where | Should be |
| --- | --- | --- | --- |
| BE-1 | Appointment slot duration | `appointments.service.ts:33` — `SLOT_MINUTES = 30` | Per-branch setting |
| BE-2 | Slot capacity | Implicit in `takenTimes()` — hardwired to 1 | Per-branch setting |
| BE-3 | Lunch / break windows | **No code exists** | Per-branch setting |
| BE-4 | Delivery charge KES 300 | Inline in `place_order` SQL | Admin setting *(client explicitly asked)* |
| BE-5 | VAT rate 16% | `cart.service.ts:16` **and** inline in SQL | Single source, admin-visible |
| BE-6 | Free-delivery threshold | Does not exist | Admin setting |
| BE-7 | Kenya counties list | `checkout/page.jsx:108` | Reference data |
| BE-8 | Lens options display string | `product/[slug]/page.jsx:589` | Configurator, priced |
| BE-9 | Cancellation window and stages | Does not exist | Admin setting |
| BE-10 | Analytics category chart | `Analytics.tsx:30` fixture | Real query |

## 4.2 Content that must become editable

| # | What | Where | Risk |
| --- | --- | --- | --- |
| BE-11 | **Fake testimonials** | `Testimonials.jsx:4` — "Sarah Johnson", "Michael Chen", "Emily Rodriguez" | Invented reviews on a Kenyan storefront. **Must not ship** |
| BE-12 | **Virtual Try-On section** | 41 lines promising "smart camera technology" | **Advertises a feature that does not exist.** Remove or label |
| BE-13 | Returns policy | 175 hardcoded lines | **Contradicts "no refunds"** |
| BE-14 | Delivery policy | 196 hardcoded lines | Contradicts the confirmed model |
| BE-15 | Warranty policy | 157 hardcoded lines | Unconfirmed wording |
| BE-16 | Privacy policy | 251 hardcoded lines | DPA 2019 — needs a named DPO |
| BE-17 | Homepage marketing copy | Hero, WhyOptex, FinalCTA, Promotional | Any change needs a deploy |
| BE-18 | Face-shape style guide | 108 static lines | Same |

## 4.3 Client-side data access that must move to the API

| # | Surface | Count | Detail |
| --- | --- | --- | --- |
| BE-19 | Admin browser **writes** | **12** | Products ×3, Appointments ×3, Promotions ×4, Prescriptions ×1, Branches ×1 |
| BE-20 | Storefront browser **writes** | **5** | Product review insert · **customer appointment booking (no validation — [CODE-REVIEW H-3](CODE-REVIEW.md))** · 3 cart writes. **Four of these hide behind `@optex/db` query helpers and do not grep as `.from(`** — see [API-MIGRATION-PLAN §2.1](API-MIGRATION-PLAN.md) |
| BE-21 | Storefront browser **reads** | **20 files** | Every data-bearing page |
| BE-22 | Admin browser **reads** | **7 pages** | Analytics, Appointments, Branches, Dashboard, Prescriptions, Products, Promotions |
| BE-23 | Browser-side discount maths | 1 | `cart/page.jsx:62-89` — shows a number the server never blessed |
| BE-24 | Raw Supabase client in React context | 1 | `AuthContext.js:33` — every descendant can query arbitrarily |
| BE-25 | Browser polls the database every 5s | 1 | `order-confirmation` — 24 polls per waiting customer |
| BE-26 | Duplicated contact backend | 1 | Next.js route *and* Nest endpoint |

**Total backend-ownership gaps: 26 categories, 31 features affected.**

**The correct stopping point is auth.** After all of the above, ~12 files still touch Supabase — all session handling, none touching a domain table. Per [ROADMAP D.4](ROADMAP.md) that residue should stay: it holds sessions, not business rules, so it cannot bypass one.

---

# Part 5 — Counts

| Category | Count |
| --- | --- |
| ✅ Completed | **51** |
| ⛔ Cancelled by client | **5** |
| ❌ Pending — Phase 1A launch blockers | **13** |
| ❌ Pending — contracted, undelivered | **10** |
| ❌ Pending — newly required by client answers | **6** |
| ❌ Pending — real gaps, unscheduled | **14** |
| ⏸ Out of scope (Phase 2 / 3 / CR-02) | **3** |
| 🔒 CR-01 Phase 1B | **5 areas, ~12 new tables** |
| **Backend-ownership gaps** | **26 categories / 31 features** |

## Reading this honestly

**The backend is strong.** 78 routes across 24 controllers, atomic checkout, both payment rails, SMS and email, cron jobs, RLS on every table, a typed client covering the whole surface. That is genuinely good work and it is why "everything from the backend" is achievable at all — the endpoints mostly exist and are simply unused.

**Three things are true and only the first is usually said:**

1. Nearly every Phase 1A *feature* exists.
2. **31 of them are not backend-owned** — hardcoded rules, browser-side data access, or content that needs a deploy to change. This is the client's stated requirement and the largest remaining body of work.
3. **Five defects sit inside features marked ✅** — three critical, in payments and checkout. They were marked done because nothing tested them.

**The launch-critical path is short:** the three payment fixes, the stock check, the catalogue, the lens prices, and one delivery threshold number. Everything else is important, contracted, or valuable — but not what stands between here and taking a real order safely.
