# OPTEX — Open Questions for the Client

**Date:** 2026-08-03 · **Updated:** 2026-08-07 (Block H added) · **Ref:** OPTEX-SOW-2025-001-KE v3.0 + CR-01
**For:** Paul (SPOC)

Grouped by urgency. **Block A alone is enough to unblock most of the remaining build** — if you answer nothing else, answer those eight.

---

## Block A — Blocking. We cannot proceed correctly without these.

| # | Question | Why we're asking | What it blocks |
| --- | --- | --- | --- |
| **A1** | **Is the store's transaction currency KES or USD?** The form says "Display currency: Dollars" and quotes prices in $ ($39, $28, $20), but the SOW, the database, and M-Pesa are all KES. | **M-Pesa settles in KES only.** A USD storefront cannot accept M-Pesa. If you want prices *shown* in USD, that's a display conversion and someone must own the exchange rate. | All pricing, checkout, payments, invoicing |
| **A2** | **The product catalogue (Section 1) came back empty.** We need one row per SKU: name, SKU code, category, brand, frame shape, material, gender, colour, MRP, selling price, cost price, tax %. | Nothing can launch without products. This is the single largest blocker. | Storefront launch, search, filters, all reporting |
| **A3** | **Same frame in multiple colours or sizes — one product or separate products?** | Determines the data model. Changing it later means re-importing the whole catalogue. | Catalogue import |
| **A4** | **Two versions of the form came back and they disagree.** In `Optex_Client_Input_Form filled.xlsx`, Section 2 has values in the wrong cells ("Pricing model → 54", "Base lens → 27"). The separate `Business model.xlsx` is clean. **Please confirm `Business model.xlsx` is the correct one.** | We've built our plan on the clean version. If that's wrong, the plan is wrong. | Commercial logic |
| **A5** | **Branch opening hours per day of the week, plus the weekly off day.** You gave one range per branch ("9am – 6pm"). We need it per weekday, e.g. Mon–Fri 9:00–18:00, Sat 9:00–16:00, Sun closed. **If all 27 branches share the same pattern, one answer covers all of them.** | The appointment system generates bookable slots directly from these hours. Without them, no branch can take a booking. | Appointments, branch pages |
| **A6** | **Appointment slots: how long is each one (15 / 30 / 60 min), how many patients can be seen at the same time, and is there a daily break (e.g. lunch 1–2pm)?** | Currently hardcoded to 30 minutes, one patient at a time, no breaks. Two of these are assumptions we made; the break feature doesn't exist yet and needs building. | Appointments |
| **A7** | **eTIMS — you said it's required.** Confirm, and note this was **not in the signed SOW**. It's KRA e-invoicing for VAT-registered traders and it's a substantial piece of work. | We'll scope and quote it as a separate change request (CR-02) rather than absorb it silently. | Invoicing, compliance |
| **A8** | **CR-01 (Section 5) came back entirely blank — including the question marked "CRITICAL — ANSWER FIRST":** do you want Phase 1A launched first with CR-01 following, or one combined build? | CR-01 roughly doubles the project. We cannot plan, sequence, or quote it without Section 5. | All of CR-01 |

---

## Block B — Delivery model. Needed before checkout is finished.

| # | Question |
| --- | --- |
| **B1** | **Full list of Wells Fargo pickup stations** you'll deliver to — name and location for each. Checkout currently asks for a street address; you've described a pickup-point model, which is a different flow entirely. |
| **B2** | **Which stations are inside the free-delivery zone?** You said "free above $39 within Nairobi." We need the threshold **in KES** (see A1) and the list of qualifying stations. |
| **B3** | **Delivery charge for orders below the threshold**, and for stations outside Nairobi. |
| **B4** | **Can customers order without creating an account?** Guest checkout is currently half-enabled — appointments allow guests, orders don't. |
| **B5** | **Can a customer cancel their own order?** If yes, up to which stage — before dispatch, or not at all? |

---

## Block C — Lens & pricing detail

| # | Question |
| --- | --- |
| **C1** | **Full lens price list.** You said "from $28" — we need every option and its price: single vision, bifocal, progressive. |
| **C2** | **Full coating price list.** "From $20" — we need anti-glare, blue-cut, photochromic, and any others, each priced. |
| **C3** | **How do lens and coating prices combine with the frame price?** Added on top, or bundled packages? |
| **C4** | **Your KRA PIN.** You confirmed you have one but didn't share it — required for M-Pesa and Pesapal KYC and for eTIMS. |
| **C5** | **Settlement bank name and account name.** Confirmed as "Yes" but not supplied. |

---

## Block D — Accounts, credentials & access

| # | Item | Status | Note |
| --- | --- | --- | --- |
| **D1** | **Google Maps API key** | You said "No" | Without it the branch locator is a list with no map. Also needed to place the 27 branches — we currently have coordinates for **none** of them. |
| **D2** | **Google Maps links for the remaining 23 branches** | 4 of 27 supplied | Alternative to D1 for placing pins. Either works; we need one. |
| **D3** | **Google Play Console account** | Not created | USD 25 one-time. Blocks Android app *submission*, not development. |
| **D4** | **Domain registrar / DNS access** | "Will share" | Needed for go-live. |
| **D5** | **Hosting decision** | "Client managed" | We'd recommend Vercel + Supabase. If you're managing hosting, we need to know the environment early — it changes the deployment work. |
| **D6** | **Paul's email address** | Missing | Named as SPOC, no contact given. |
| **D7** | **Email sending domain** (e.g. `orders@optexopticians.com`) | Not discussed | Order confirmations need a verified sender domain. |
| **D8** | **SMS sender ID** for Africa's Talking | Not discussed | Appears as the sender name on customer texts. Requires registration lead time. |
| **D9** | **Google Analytics account** | Not discussed | For conversion tracking. |
| **D10** | **WhatsApp Business number** | Not discussed | Only if you want the chat feature — it's in the SOW but unbuilt. Confirm whether you still want it. |

---

## Block E — Content & assets

| # | Question |
| --- | --- |
| **E1** | **Product photography.** The form asks whether you have photos ready, need background removal, or are arranging separately — unanswered. Nothing displays without images. |
| **E2** | **Real customer testimonials.** The homepage currently carries placeholder testimonials with invented names. We need 3–5 genuine ones (name + quote + permission to publish), or we'll remove the section. |
| **E3** | **Virtual Try-On is advertised on the homepage but is Phase 3 — it doesn't exist yet.** Remove the section for launch, or label it "coming soon"? |
| **E4** | **Exact returns / refund wording.** You said "No refunds." Our current returns page describes a returns process, which contradicts that. Please supply the policy you want published — this is customer-facing and legally relevant. |
| **E5** | **Warranty terms.** Same — confirm the published wording. |
| **E6** | **Confirm we should remove Cash on Delivery** from checkout (you said "not offering"). |
| **E7** | **Confirm no discounts or promotions at launch** (you said "N/A"). The promotions engine is fully built — we'd hide the interface rather than delete it, so it's ready when you want it. |

---

## Block F — Data protection (Kenya DPA 2019)

| # | Question |
| --- | --- |
| **F1** | **Who is Optex's Data Protection Officer?** Name and email. Prescription and eye-test data is health data under the Act. |
| **F2** | **How long should prescription records be retained?** e.g. 5 years. |
| **F3** | **Patient consent wording** for storing prescription and medical data — do you have approved text, or should we draft it for your legal review? |

---

## Block G — CR-01, if you want it quoted

We can't estimate or schedule any of this until Section 5 is answered. Listed here so it can be answered in one pass.

**Delivery model** — Phase 1A first then CR-01, or one combined build? *(the critical one)*

**Inventory:** inter-branch transfers? Purchase orders? Goods received notes? Stock adjustments with reason codes? Supplier records? Dead-stock reporting? Physical stock counts? Valuation method — FIFO or weighted average? Per-frame serial tracking or SKU-level only? Who approves purchase orders?

**Multi-role logins:** confirm the seven roles (Super Admin, Branch Manager, Branch Staff, Inventory Manager, Accountant, Marketing, Doctor). Does a Branch Manager see only their own branch? Which roles need two-factor authentication? How long should audit logs be kept? Do you have the initial user list?

**Branch profit & loss:** setup cost per branch? Monthly expense categories? Who enters them? For an online order, which branch gets the revenue — the delivering branch, the nearest, or customer's choice? Which reports do you need?

**Product analysis:** is cost price per SKU available (it's a column in Section 1)? Should "days on shelf" count from goods-received date or product creation date? Do you want scheduled email report digests — to whom, how often?

**Doctors:** list of doctors with qualifications, branch and languages. Weekly availability per doctor per branch. Who manages leave — the doctor or an admin? Consultation types and durations. Consultation fee (you said eye tests are free — does that cover all consultation types?). Paid at booking or at the clinic? Do you have an e-prescription template?

---

## Block H — Stock, fulfilment & payment operations

*Added 2026-08-07 following the [code review](CODE-REVIEW.md). These are new — they came out of reading the code, not the input form.*

| # | Question | Why we're asking |
| --- | --- | --- |
| **H1** | **What should a customer see when an item is out of stock?** Hide the product, show it greyed out as "Out of stock", or accept the order and fulfil when restocked? | The system currently has **no connection between stock levels and ordering** — a customer can order 1,000 units of an item you have 1 of, and nothing stops them. We need your rule before we build the block. |
| **H2** | **You said stock is held centrally and reconciled monthly. For an online order, which stock figure should gate it?** A single central pool, or the stock at a specific branch? | Determines whether an online order can be blocked at all. Monthly reconciliation means the number will often be stale, which affects how strictly we should enforce it. |
| **H3** | **If stock runs out between the customer ordering and you picking the order, what should happen?** Cancel and refund, contact the customer, or hold until restocked? | You've said "no refunds", so we need the alternative path defined. This is a customer-facing promise and should be in the policy pages. |
| **H4** | **Is KES 300 flat delivery your actual current charge?** It's hardcoded in the system today. | Related to B3. If the Wells Fargo model replaces it we'll delete it, but we shouldn't be charging a number nobody confirmed in the meantime. |
| **H5** | **If M-Pesa or Pesapal reverses a payment after you've dispatched, who handles it and how?** | Pesapal reports a "reversed" status that the system records but does nothing with. Given "no refunds", a provider-side reversal is the one case where money leaves regardless of policy — it needs an owner. |
| **H6** | **Who at Optex owns daily payment reconciliation?** Name and role. | The admin panel has a payments reconcile screen. It needs a named operator, and that person's actions have financial consequences — it's also the strongest argument for the RBAC work in CR-01. |

**One item we are not asking about, only flagging:** the code review found a **critical security defect in the M-Pesa payment path** ([CODE-REVIEW.md C-1](CODE-REVIEW.md)) that would let a customer mark an order paid without paying. It is being fixed this sprint and needs no decision from you — but it is a **hard blocker on go-live**, and we're telling you rather than quietly closing it.

---

## What we're proceeding with meanwhile

So you know nothing is stalled: we're continuing on payments integration (your Daraja credentials and Pesapal merchant account are ready — thank you, that unblocked a significant piece), search engine optimisation, the admin panel, and internal quality work. None of that depends on the answers above.

**One correction worth flagging:** the progress tracker you were sent understates where we are. Several items listed as "upcoming" — M-Pesa, Pesapal, order confirmation SMS and email, order tracking, reviews, promotions, policy pages, and the entire admin panel — are built and working. We'll send you a corrected tracker alongside this.
