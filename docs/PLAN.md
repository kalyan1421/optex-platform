# OPTEX — Working Plan (Post CR-01)

**Document:** Working Build Plan
**Binding contract:** OPTEX-SOW-2025-001-KE + Change Request CR-01
**Status:** Internal — pending client confirmation on delivery model
**Last updated:** 2026-05-21

---

## 0. Strategic decision (client must confirm first)

Two delivery models are on the table. Lock this before sprint planning:

| Option | Description | Recommended for |
|---|---|---|
| **A. Split (Phase 1A + 1B)** | Ship original signed SOW first, go live with e-commerce. CR-01 features ship as Phase 1B after launch. | Recommended — protects launch date, lets us earn revenue while CR-01 modules are built. |
| **B. Combined** | One single launch with all CR-01 items included. Longer build window before any revenue. | Only if Optex has no urgency to start trading online. |

**Recommendation:** Option A. The remainder of this plan assumes A. If client picks B, Phases 1A and 1B fold into a single combined phase using the same module sequencing.

---

## 1. Guiding principles

1. **CR-01's dependency chain dictates order:** RBAC is foundational — every other module reads from it. Inventory ledger is the prerequisite for product lifecycle analytics. Doctor consultation extends appointments. Branch financials is independent.
2. **Ship vertical slices, not horizontal layers.** Each sprint delivers one usable end-to-end module (UI + API + DB + tests), not "all schemas this week, all UIs next week."
3. **Keep the original SOW promises intact.** CR-01 cannot delay the Phase 1A go-live. Anything that risks the launch date moves to 1B.
4. **Compliance is not an afterthought.** Kenya DPA 2019 (health data) must be designed in from the start of the Doctor module, not bolted on.
5. **Stage early, stage often.** Every merged sprint output is live on the staging URL the same day.

---

## 2. Phase 1A — Original SOW go-live

Closes out the signed scope. No CR-01 work in this phase. Targets the original Phase 1 milestone (production deployment + handover).

### Sprint 1A.1 — Catalogue & Storefront completion
- PLP filters: price / brand / shape / gender / material — wire to Supabase queries
- Product search + autocomplete (Supabase full-text search)
- Category landing pages (Eyeglasses, Sunglasses, Kids, Computer, Reading) with SEO copy
- JSON-LD: LocalBusiness, MedicalOrganization, FAQ schemas (Product already done)
- WebP image pipeline + Cloudflare CDN tuning → LCP < 2.5s

**Exit:** Storefront browsable end-to-end on staging, Lighthouse mobile ≥ 90.

### Sprint 1A.2 — Cart → Checkout → Payment
- Multi-step checkout: address, delivery, payment, review
- Guest checkout path (no forced signup)
- M-Pesa Daraja STK Push integration + callback handler
- Pesapal IPN integration (cards / wallets fallback)
- COD path with order confirmation
- Order confirmation SMS (Africa's Talking) + email (Resend/SES)
- Edge function for webhook receivers (signature verification, idempotency)

**Exit:** A test customer can buy a frame on staging via M-Pesa, Pesapal, and COD; admin sees the order; SMS + email arrive.

### Sprint 1A.3 — Account, Prescriptions, Reviews, Policies
- Customer account: profile, order history, saved prescriptions
- Multi-stage order tracking page (Received → Processing → Dispatched → Delivered)
- Prescription upload flow (private Supabase Storage bucket, namespaced by customer id)
- Basic lens selection at PDP: Single Vision, Bifocal, Progressive + coating add-ons
- Reviews & ratings with JSON-LD review schema
- Trust / warranty / returns / delivery / privacy policy pages
- WhatsApp floating chat button (`wa.me` deep-link)

**Exit:** Full customer-side feature set per signed SOW is live on staging.

### Sprint 1A.4 — Admin v1 (Super-Admin-only, per signed SOW)
- Products: full CRUD with image upload to Supabase Storage
- Inventory: stock-level per branch + low-stock alerts (SOW-only scope — no PO/GRN yet)
- Orders: status workflow + M-Pesa reference validation + SMS triggers
- Appointments: view bookings, confirm / reschedule / cancel (SOW-only — no doctor concept yet)
- Customers, Prescriptions, Reviews, Promotions, Branches, Payments, Basic Analytics — wire all 13 screens to live data

**Exit:** Single Super Admin can run the storefront end-to-end. All 13 SOW admin screens fully wired.

### Sprint 1A.5 — Go-live
- GA4 + conversion tracking
- UAT cycle with Optex SPOC on a staging snapshot of real data
- Bug-fix burn-down
- Production deployment to Vercel + Cloudflare
- Admin training session + PDF + screen-recorded video
- Source-code handover to client GitHub org

**Exit:** Optex storefront is **LIVE** under the original SOW commitment. 60-day warranty clock starts.

---

## 3. Phase 1B — CR-01 features

Sequenced per CR-01 §4 recommended build order. Each sprint is a vertical slice with DB + API + admin UI + tests.

### Sprint 1B.1 — Multi-Role Admin (RBAC) — *foundational*
Every other CR-01 module depends on this.
- DB: `roles`, `role_permissions`, `user_roles`, `audit_log` tables
- 7 roles: Super Admin, Branch Manager, Branch Staff, Inventory Manager, Accountant/Finance, Marketing, Doctor/Optometrist
- Granular permission matrix per module (view / create / edit / delete)
- Permission middleware applied to every existing endpoint
- Re-render all 13 admin screens as permission-aware (hide/show by role)
- Branch-scoped data filtering for Branch Manager and Branch Staff
- User management screen — create users, assign role(s), assign branch(es)
- Admin action audit log
- Two-factor authentication for Super Admin, Accountant, Doctor (TOTP via Supabase Auth)

**Exit:** Login as each of 7 roles on staging → each sees only what their role permits. Audit log captures every mutation.

### Sprint 1B.2 — Inventory Management (full ledger)
Prerequisite for product lifecycle analytics.
- DB: `suppliers`, `purchase_orders`, `po_lines`, `grn`, `grn_lines`, `stock_transfers`, `stock_transfer_lines`, `stock_adjustments`, `stock_ledger`, `reorder_points` (~8–10 tables)
- Real-time inventory ledger per SKU per branch (event-sourced — every PO, GRN, transfer, sale, adjustment is a ledger row)
- Inter-branch stock transfer workflow (request → approve → dispatch → receive)
- Purchase Order module (create, approve, track to suppliers)
- Goods Received Note (GRN) raised against POs
- Stock adjustments with reason codes (damage, theft, audit)
- Supplier / vendor master data
- Reorder point + reorder quantity per SKU per branch with alert
- Stock valuation: FIFO or weighted average (client confirms which)
- Dead-stock / aging inventory report
- Physical stock count + reconciliation module

**Exit:** A frame ordered from a supplier flows through PO → GRN → branch stock → transfer → customer sale, and every step is auditable from the ledger.

### Sprint 1B.3 — Eye Doctor Consultation (expands Appointments)
Depends on RBAC (Doctor role) and the customer Appointments flow built in 1A.
- DB: `doctors`, `doctor_branch_assignments`, `doctor_availability`, `doctor_leave`, `consultation_types`, `consultations`, `consultation_notes` (~7 tables)
- Doctor / optometrist master data (qualifications, photo, bio)
- Doctor-to-branch assignment + weekly availability schedule
- Doctor leave / blocked-dates calendar
- Consultation types (eye test, exam, contact-lens fitting, paediatric, follow-up) with durations + fees
- Real-time slot availability driven by doctor schedule + existing bookings
- Customer booking wizard expanded from 3 steps to 5: City → Branch → Consultation Type → Doctor → Date/Time
- Patient details + reason-for-visit captured at booking
- 24-hour + 1-hour SMS reminders
- Doctor / staff in-clinic consultation queue (checked-in → in-consultation → completed)
- Consultation notes + post-consultation prescription entry
- Patient medical profile and prescription history timeline
- e-Prescription / consultation summary PDF generation
- Consultation fee pre-payment via M-Pesa / Pesapal (reuse Phase 1A gateway), with pay-at-clinic fallback
- Doctor utilisation, no-show, and consultation-revenue reports
- Day / week / month calendar views per doctor
- Drag-and-drop admin rescheduling

**Compliance (must ship inside this sprint, not after):**
- Patient consent flow at booking (capture + store + version)
- Privacy policy update covering medical-record handling
- Retention rules for consultation records (configurable, default 7 years)
- DPO contact field on the privacy page

**Exit:** A customer books a paid eye-test with a named doctor at a chosen branch, pays via M-Pesa, gets reminders, attends, doctor records notes + e-prescription, customer downloads the PDF from their account.

### Sprint 1B.4 — Product Analysis & Lifecycle Reporting
Depends on Inventory ledger (1B.2) being live + cost-price field added to products.
- DB: 2 new tables + materialized views (`mv_sales_velocity`, `mv_stock_to_sales`, etc.) refreshed nightly
- Cost-price field on every SKU (data migration with client-provided spreadsheet)
- Reports:
  - Days-on-shelf per SKU (GRN inward date → first sale)
  - Sell-through rate per product per branch
  - Sales velocity (rolling 7 / 30 / 90 days)
  - Fast-mover / slow-mover lists
  - Dead-stock report (zero sales over a configurable window)
  - Product margin analysis (price − cost, weighted by mix)
  - Stock-to-sales ratio + category breakdown
  - Seasonal trend chart (12-month rolling)
  - Product return rate + lifecycle view per SKU
- CSV / Excel export on every report
- Scheduled email digests (daily / weekly / monthly — recipients + content configurable by Super Admin)

**Exit:** Optex finance / merchandising team can answer "what's profitable, what's not, what should we reorder, what should we mark down" from the admin panel alone.

### Sprint 1B.5 — Branch Investment vs Revenue Analysis
Independent track — can run in parallel with 1B.3/1B.4 if a second engineer is available.
- DB: `branch_capex`, `branch_opex`, `branch_revenue_attribution` (3 tables)
- Branch capex entry (setup cost, fit-out, equipment)
- Monthly opex tracking per branch (rent, salaries, utilities, marketing, other) — entered by Accountant role
- Revenue attribution rules per branch (online orders → delivery branch or nearest; in-store → manual entry until POS integration is in scope)
- Branch P&L statement (revenue − opex, by month)
- ROI per branch (cumulative profit ÷ capex)
- Break-even analysis (months to recover capex)
- Side-by-side branch comparison dashboard
- Branch ranking + trend charts
- Scheduled monthly snapshot job

**Exit:** Optex management can see "which branch is making money, which is bleeding, when each broke even" without leaving the admin panel.

### Sprint 1B.6 — UAT, polish, training, go-live (1B)
- UAT with role-specific test scripts (one per role)
- Performance pass: report queries must return in < 2 seconds on a year of data
- Updated admin training docs covering all new roles + modules
- Doctor onboarding mini-guide (separate, shorter)
- Updated privacy policy + DPA consent flow live
- Production deployment

**Exit:** All CR-01 modules live in production. 60-day warranty clock starts on 1B.

---

## 4. Phase 2 — Android Flutter app (post Phase 1B)

Out of scope until Phase 1B is live and warranty-stable. Phase 2 plan is unchanged from the SOW — Flutter app mirrors the website, plus push notifications, offline browsing, in-app M-Pesa SDK, prescription upload, branch locator, reviews, and an admin companion APK.

The CR-01 modules (RBAC, Inventory, Doctor, Analytics) are admin-side only and don't require app-side changes, **except** the customer-facing 5-step booking wizard which the app must mirror.

---

## 5. Critical-path dependencies (visual)

```
Phase 1A goes live  ──────────────────────────────►  Optex earning revenue online
        │
        └── unlocks ──► [1B.1 RBAC]
                            │
                            ├──► [1B.2 Inventory]
                            │        │
                            │        └──► [1B.4 Product Analytics]
                            │
                            ├──► [1B.3 Doctor Consultation]
                            │
                            └──► [1B.5 Branch Financials]  (parallel-safe)
                                        │
                                        └──► [1B.6 UAT + Go-live]
```

**Bottleneck:** 1B.1 (RBAC). It blocks 4 of 5 CR-01 modules. Staff the RBAC sprint with the strongest backend engineer and don't start any other 1B work until permission middleware is merged.

---

## 6. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Client picks Option B (combined) and pressures for original launch date | Medium | High — burns trust | Reconfirm scope vs. timeline in writing on Day 1; share this plan as the calibration |
| Cost-price data missing for SKUs | High | Blocks 1B.4 entirely | Make cost-price a non-optional column in the onboarding spreadsheet (Part B Item 1 of the onboarding email) |
| DPA 2019 compliance treated as docs-only | Medium | High — regulatory + reputational | Bake consent capture into 1B.3 build, not into a separate doc sprint |
| Doctor list / schedules not provided in time | High | Blocks 1B.3 | Schedule the doctor-onboarding workshop **during** 1B.1 so data lands before 1B.3 starts |
| Inventory ledger backfill from existing register books | High | Risk of garbage-in to 1B.4 reports | Agree a single "opening stock as of date X" cut-over; treat anything before as out-of-scope historical |
| Two-factor auth UX friction for Doctors | Medium | Adoption risk | Default Doctor 2FA to optional, Super Admin + Accountant mandatory |
| Performance — joined queries across ledger + sales | Medium | High once data grows | Materialized views refreshed nightly for 1B.4; index review at end of each sprint |
| Audit-log table grows unbounded | Low | Medium (storage cost) | Partition by month; archive to cold storage after 24 months |

---

## 7. Sequence summary (one-glance)

1. Lock delivery model (A vs B) with client — **prerequisite**
2. Phase 1A → original SOW launch (5 sprints)
3. Phase 1B.1 → RBAC (foundational gate)
4. Phase 1B.2 → Inventory ledger
5. Phase 1B.3 → Doctor consultation + DPA compliance
6. Phase 1B.4 → Product analytics (after ledger live)
7. Phase 1B.5 → Branch financials (parallel-safe)
8. Phase 1B.6 → UAT + go-live for 1B
9. Phase 2 → Flutter Android app

---

## 8. Open decisions blocking start

The following must be answered before each sprint can begin. Listed against the sprint they unblock.

| # | Decision | Blocks |
|---|---|---|
| 1 | Delivery model A vs B | All of Phase 1B |
| 2 | Stock valuation method (FIFO / weighted average) | 1B.2 |
| 3 | Batch / serial tracking required or SKU-level only | 1B.2 |
| 4 | Final role list + permission matrix sign-off | 1B.1 |
| 5 | 2FA — which roles, mandatory or optional | 1B.1 |
| 6 | Cost-price spreadsheet for every SKU | 1B.4 |
| 7 | Doctor master list + qualifications + photos | 1B.3 |
| 8 | Consultation types, durations, fees | 1B.3 |
| 9 | Pre-payment policy for consultations | 1B.3 |
| 10 | Patient consent flow + DPO designation | 1B.3 |
| 11 | Branch capex baseline + opex categories | 1B.5 |
| 12 | Revenue attribution rule (in-store sales source) | 1B.5 |
| 13 | Report digest recipients + cadence | 1B.4 |
| 14 | Commercial CR-01 quotation signed | All of Phase 1B |
