# OPTEX — Project Audit & Tech-Debt Report

**Date:** 2026-05-11 · **Scope:** `Frontend/optex-admin`, `Frontend/optex-web`, missing `Backend/` · **Binding contract:** OPTEX-SOW-2025-001-**KE** v3.0 (Kenya edition, 8-week single phase)

---

## 0. Source-of-truth inputs

| Source               | Location                                                                                             | Status                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Binding SOW**      | `/Users/kalyan/Client/OPTEX /OPTEX OPTICIANS.pdf` (v3.0 KE)                                          | Read                                                                                   |
| Superseded India SOW | `/Users/kalyan/Client/OPTEX /Optex_SOW_Quotation.pdf` (v1.0 IN)                                      | Read — **do not implement against this**                                               |
| Strategy report      | `/Users/kalyan/Client/OPTEX /Optex_Ecommerce_Strategy_Report.pdf`                                    | Read (1-10 of 28)                                                                      |
| Notion Hub           | `OPTEX OPTICIANS — Digital Transformation Hub`                                                       | Fetched: hub, Website Redesign Plan, Full Feature List, Admin Spec (13 screens), Risks |
| Figma                | `figma.com/design/D0kzp43FOwBevQSV66XOT2/Optex` (customer storefront)                                | Overview screenshot fetched; per-node metadata timed out                               |
| Admin Figma          | `figma.com/design/eFGBgVE1CJ5DWFMi8vZKcF/Complete-Admin-Panel-Screens` (per `optex-admin/README.md`) | Different file from the link the user shared — not pulled                              |

Two SOWs exist. **The Kenya v3.0 supersedes the India v1.0** in every material area: payments (M-Pesa/Pesapal/COD vs Razorpay/UPI), single 8-week phase (vs 16-week + Phase 2), Super Admin only (vs 3 roles), AR Try-On **in scope** (vs out of scope), KES currency + 16% VAT.

---

## 1. The headline

**Both current codebases are misaligned with the binding SOW and need to be rebuilt rather than ported.** The current repo is a Figma-Make export (admin) + a CRA prototype (web), neither of which can host the Kenya commerce flows (M-Pesa Daraja STK push callbacks, Pesapal IPN, Supabase Auth+RLS, JSON-LD/SSR, sub-2.5s LCP).

| Pillar          | SOW requires                                   | Current state                                                                   | Action                 |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| Web framework   | **Next.js 14** (SSR/SSG)                       | CRA (`react-scripts 5`)                                                         | **Rebuild**            |
| Admin framework | **Next.js 14** (same monorepo)                 | Vite 6 SPA, no router                                                           | **Rebuild**            |
| Backend         | **Node.js + Express REST**                     | Empty `Backend/` folder                                                         | **Build from scratch** |
| Database        | **Supabase Postgres** (+ Auth + Storage + RLS) | None                                                                            | **Build from scratch** |
| Payments        | **M-Pesa Daraja** + **Pesapal** + COD          | None                                                                            | **Build from scratch** |
| Hosting         | **Vercel + Cloudflare**                        | Firebase Hosting                                                                | **Migrate**            |
| State of cart   | Persistent (DB-backed)                         | In-memory `CartContext` with 3 hard-coded items                                 | **Replace**            |
| Mobile-first    | Required (70%+ Kenyan traffic on mobile)       | Desktop-first; magic `pt-[100px]/[118px]` paddings, no `md:` rules on key pages | **Re-design**          |

Trying to retrofit Supabase + Daraja + SSR onto CRA+Vite costs **more** labour than a clean Next.js 14 monorepo build using the existing shadcn UI components and Tailwind tokens.

---

## 2. Figma ↔ Codebase comparison

The Figma file you linked (`D0kzp43FOwBevQSV66XOT2`) is the **customer storefront** design. The admin Figma is a separate file (`eFGBgVE1CJ5DWFMi8vZKcF`, per [optex-admin/README.md](../Frontend/optex-admin/README.md)).

### Storefront — Figma frames visible in overview

Mobile-width frames (3 home variants on the left) + desktop frames (right): **Home**, **Shop / PLP** (with left filter rail), **PDP**, **Cart / Checkout**, **Branch Locator (with map)**, **Login**, **Signup**, **Profile**, **Contact**. Brand palette visible top-center: navy `#2A3182`, red `#D83232`/`#E53935`, dark `#1A1A2E`, on white.

### Mapping to `optex-web` pages

| Figma frame                | Code (`src/pages/`)                 | Implementation status                                                                         |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Home (mobile + desktop)    | `Home/Home.jsx` + 9 sub-sections    | UI shell present; data hard-coded; AOS animations everywhere; mobile breakpoints partial      |
| Shop / PLP w/ filters      | `Shop/Shop.jsx`                     | Sidebar exists but filters non-functional; tablet (768-1024px) falls through to mobile layout |
| Product detail             | `ProductDetails/ProductDetails.jsx` | One hard-coded product; `lg:` only — no `md:`                                                 |
| Cart                       | `Cart/Cart.jsx`                     | Renders 3 seed items from `CartContext`                                                       |
| Checkout                   | `Checkout/Checkout.jsx`             | 3-step UI exists; form has no state, no submit; no M-Pesa/Pesapal                             |
| Login / Signup             | `Login/`, `Signup/`                 | Page shells, no auth                                                                          |
| Profile                    | `Profile/Profile.jsx`               | Static UI                                                                                     |
| Contact                    | `Contact/Contact.jsx`               | Static iframe map embed (not Branch Locator with DB-driven pins)                              |
| Branch Locator             | —                                   | **Missing** as a dedicated route                                                              |
| Appointment Booking wizard | —                                   | **Missing** entirely                                                                          |
| Order Tracking             | —                                   | **Missing** entirely                                                                          |
| /try-on landing (Phase 3)  | `Home/components/VirtualTryOn.jsx`  | Stub component only                                                                           |

**Mobile vs desktop fidelity:** Figma has explicit mobile-width frames for the home page — the current code does a one-size layout with sporadic `lg:` overrides. See §4 below.

### Brand tokens — Figma vs code

| Token         | Figma                 | `optex-web` Tailwind             | `optex-admin` theme                    |
| ------------- | --------------------- | -------------------------------- | -------------------------------------- |
| Primary navy  | `#2A3182`             | `brand.blue = #2A3182` ✓         | `--primary: #030213` ✗ (different)     |
| Accent red    | `#D83232` / `#E53935` | `brand.red = #E53935` ✓          | `--destructive: #d4183d` ✗ (different) |
| Sans font     | (one clean sans)      | `Montserrat` ✓                   | shadcn default ✗                       |
| Heading scale | per frame             | `text-[40px] sm: md:` — magic px | unset, uses `--text-*` defaults        |

The two apps **do not share a design system** today — admin uses shadcn's default `oklch` theme; web uses brand-token hex. In a Next.js monorepo this becomes a single `packages/ui` with the same Tailwind config.

---

## 3. Admin (`optex-admin`) — tech-debt findings

**Stack:** Vite 6 + React 18 + TS + Tailwind v4 + Radix shadcn + **unused MUI**, single-file state-machine routing in [App.tsx:16](../Frontend/optex-admin/src/app/App.tsx).

### 3.1 Coverage vs the 13 required admin screens

All 13 screens **exist as fixture UI** in `src/app/components/admin/`. **None are wired to a backend.** Login is exported only into `src/imports/Login/` and never imported into `App.tsx`.

| Screen        | UI                              | Backend wiring                               |
| ------------- | ------------------------------- | -------------------------------------------- |
| Dashboard     | ✓ (fixtures)                    | ✗                                            |
| Analytics     | ✓                               | ✗                                            |
| Products      | ✓ + Add/Edit dialog             | ✗ — no image upload to Supabase Storage      |
| Inventory     | ✓ + inline cell edit + CSV      | ✗                                            |
| Orders        | ✓ + status modal                | ✗ — no M-Pesa ref validation, no SMS trigger |
| Appointments  | ✓                               | ✗                                            |
| Customers     | ✓                               | ✗                                            |
| Prescriptions | ✓ + preview modal               | ✗ — no Storage                               |
| Reviews       | ✓                               | ✗                                            |
| Promotions    | ✓                               | ✗                                            |
| Branches      | ✓                               | ✗                                            |
| Payments      | ✓ M-Pesa / Pesapal / COD tabs   | ✗ — no Daraja webhook receiver               |
| Login         | exists in `imports/Login/` only | not in App.tsx                               |

### 3.2 Stack mismatch

| Current                                                                                         | Required                  | Verdict                               |
| ----------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| Vite 6 SPA                                                                                      | Next.js 14 (app router)   | **Replace** — no router today         |
| State-machine routing (App.tsx:26-44)                                                           | File-based routes         | **Replace**                           |
| Tailwind v4 (`@tailwindcss/vite`)                                                               | Tailwind v3 (matches web) | **Downgrade**                         |
| Firebase Hosting (`optex-adminpanel`)                                                           | Vercel                    | **Migrate**                           |
| MUI in `package.json` (unused)                                                                  | —                         | **Delete** — ~2MB dead deps           |
| `figma:asset/` Vite plugin → `src/assets/` (dir doesn't exist)                                  | —                         | **Delete** — build hazard             |
| `src/imports/{Login,Signup,Main,CartPage,CheckoutPage,ProfileScreen,...}` 15+ generated folders | —                         | **Delete** — none imported by App.tsx |

### 3.3 Code-quality hotspots

- **Hard-coded fixtures pervasive.** `Dashboard.tsx:12-76`, `Products.tsx:30-39`, `Orders.tsx:29-38`, `Inventory.tsx:16-27` all contain inline fake records that must be torn out before API wiring.
- **Duplicate color/status maps** across Dashboard/Orders/Appointments — extract to `lib/constants.ts`.
- **No form validation** on Products/Appointments dialogs despite `react-hook-form` already being in deps.
- **Accessibility gaps**: missing `htmlFor`/`id` on form labels, no `aria-current` on status tabs, no `aria-label` on Inventory inline-edit inputs.
- **Sidebar is not responsive**: [AdminSidebar.tsx:53](../Frontend/optex-admin/src/app/components/admin/AdminSidebar.tsx) is fixed `w-64`. On iPad (768px) it eats 33% of viewport. `Sheet` is in `ui/` but unused — add a drawer for `< md`.

### 3.4 Verdict (admin)

**Scrap & rebuild as a route group inside the Next.js monorepo.** All 13 screens are pure UI with fixtures; porting them to Next.js routes + Supabase queries is the same labour as a fresh `npx create-next-app` + `shadcn-ui init`, but without dragging Vite/Firebase/MUI/Figma-import debt. Preserve: shadcn `ui/*` primitives (reusable), the page-component layouts, and the TypeScript interfaces (`Product`, `Order`, …). Discard everything else.

---

## 4. Web (`optex-web`) — tech-debt + responsiveness findings

**Stack:** CRA `react-scripts 5` + React 19 + JS/JSX + Tailwind v3 + react-router-dom v7 + AOS.

### 4.1 Coverage vs required customer features

| Feature group                                                                                       | Status                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Hero / Featured / Testimonials                                                               | UI shell only (no CMS)                                                                                                                      |
| Category pages (Eyeglasses / Sunglasses / Kids / Computer / Reading)                                | **Missing as category routes**; `/shop` is one static list                                                                                  |
| PLP filtering (price/brand/shape/gender/material)                                                   | Filter UI on Shop.jsx — non-functional                                                                                                      |
| PDP + multi-angle + reviews + lens options                                                          | Stub; single hard-coded product                                                                                                             |
| Search + autocomplete (Supabase FTS)                                                                | **Missing**                                                                                                                                 |
| Cart with persistent sessions                                                                       | `CartContext` in-memory, **3 hard-coded seed items every mount** ([CartContext.js:11-42](../Frontend/optex-web/src/context/CartContext.js)) |
| Multi-step checkout                                                                                 | UI accordion; **no form state, no submit**                                                                                                  |
| **M-Pesa STK Push**                                                                                 | **Missing**                                                                                                                                 |
| **Pesapal**                                                                                         | **Missing**                                                                                                                                 |
| **COD**                                                                                             | **Missing**                                                                                                                                 |
| Order confirmation SMS+email                                                                        | **Missing**                                                                                                                                 |
| Order tracking page                                                                                 | **Missing**                                                                                                                                 |
| User account / auth                                                                                 | Page shells; no auth backend                                                                                                                |
| **Appointment booking wizard** (3-step)                                                             | **Missing**                                                                                                                                 |
| **Branch locator** (Google Maps)                                                                    | **Missing** (Contact iframe ≠ locator)                                                                                                      |
| Prescription upload                                                                                 | **Missing**                                                                                                                                 |
| Reviews + JSON-LD                                                                                   | **Missing**                                                                                                                                 |
| Trust / warranty / returns pages                                                                    | **Missing**                                                                                                                                 |
| Promotions engine                                                                                   | UI stub                                                                                                                                     |
| WhatsApp floating button (`wa.me` deep-link only — Business API is out of scope per Kenya SOW §8.2) | **Missing**                                                                                                                                 |
| GA4                                                                                                 | **Missing**                                                                                                                                 |
| JSON-LD: Product / LocalBusiness / MedicalOrganization / FAQ                                        | **Missing**                                                                                                                                 |

### 4.2 Stack mismatch

| Current                   | Required                     | Verdict                                                                             |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| CRA (react-scripts)       | Next.js 14                   | **Replace** — CRA blocks SSR/SSG, `next/image`, edge functions for Daraja callbacks |
| JavaScript / JSX          | TS recommended (admin is TS) | **Migrate to TS** for monorepo consistency                                          |
| AOS animations            | n/a (or framer-motion)       | **Replace with framer-motion** — AOS scroll-listener cost on low-end Android 4G     |
| Tailwind v3               | Tailwind v3 ✓                | **Keep**                                                                            |
| Firebase Hosting          | Vercel + Cloudflare          | **Migrate**                                                                         |
| `CartContext` (in-memory) | Supabase-backed cart         | **Replace**                                                                         |

### 4.3 Responsiveness audit (mobile + desktop)

**Score: 6/10** — desktop-acceptable, mobile-to-tablet transitions broken.

| Issue                                                                                       | File:line                                                                        | Impact                                                                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Magic-number top padding `pt-[100px]` / `pt-[118px]` with only one `sm:pt-[120px]` override | [MainLayout.jsx:16-20](../Frontend/optex-web/src/layouts/MainLayout.jsx)         | Header height changes mid-scroll cause CLS on tablet                      |
| `overflow-x-hidden` masking real overflow bugs                                              | MainLayout.jsx:19                                                                | Hides regressions instead of fixing them                                  |
| Shop sidebar: no `md:` rules, jumps from mobile→`lg:w-[240px]`                              | `Shop.jsx:139`                                                                   | Tablet users get the mobile layout (no sticky filter)                     |
| PDP image grid `grid-cols-4` at every breakpoint                                            | `ProductDetails.jsx:71`                                                          | Thumbnails ~80px on small mobile — should be `grid-cols-3 sm:grid-cols-4` |
| `<img>` not lazy-loaded, no `srcset`, no WebP                                               | most pages                                                                       | LCP ~3.5s — SOW requires < 2.5s                                           |
| Form inputs missing `htmlFor`/`id` pairing                                                  | `Checkout.jsx:88-102`                                                            | Screen readers cannot announce field names                                |
| File extension chaos (`.js` vs `.jsx`)                                                      | `Footer.js`, `FaceShape.js`, `Promotional.js`, vs `Navbar.jsx`, `Hero.jsx`, etc. | No type safety; ESLint won't help                                         |

Mobile-first Figma frames exist for Home — the code does **not** match them.

### 4.4 Verdict (web)

**Migrate to Next.js 14.** CRA cannot meet the SOW's hard requirements: `next/image` for WebP/srcset/LCP<2.5s, SSR for JSON-LD, edge/serverless for the M-Pesa Daraja callback, and Vercel deployment. Reuse: brand tokens in `tailwind.config.js`, the page component layouts as a starting visual reference, and the `MainLayout` chrome (after deleting the magic paddings). Discard: AOS, CRA build pipeline, in-memory CartContext.

---

## 5. Backend (Supabase + Node.js/Express) — proposed plan

Currently `Backend/` is empty. Below is the build plan derived from the Notion admin spec + Kenya SOW.

### 5.1 Supabase Postgres schema (admin-spec-aligned)

```sql
-- Auth/roles
create type user_role as enum ('super_admin', 'customer');
-- (Super Admin only — no branch_manager/staff in this SOW)

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- 'Nairobi CBD', 'Westlands', 'Mombasa Road'
  slug text unique not null,
  address text, phone text,
  lat numeric, lng numeric,
  hours jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- Eyeglasses, Sunglasses, Kids, Computer, Reading
  slug text unique not null,
  display_image text
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category_id uuid references categories(id),
  brand text, frame_material text, frame_shape text, gender text,
  description text,
  price_kes numeric(10,2) not null,
  images text[] default '{}',           -- Supabase Storage URLs
  try_on_image_url text,                -- Phase 3 transparent PNG
  is_active boolean default true,
  search_tsv tsvector generated always as
    (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(sku,''))) stored,
  created_at timestamptz default now()
);
create index on products using gin(search_tsv);

create table inventory (
  product_id uuid references products(id) on delete cascade,
  branch_id uuid references branches(id) on delete cascade,
  stock int not null default 0,
  primary key (product_id, branch_id)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text, email text, phone text,
  created_at timestamptz default now()
);

create type order_status as enum
  ('pending_payment','received','processing','dispatched','delivered','cancelled');
create type payment_method as enum ('mpesa','pesapal','cod');
create type payment_status as enum ('pending','paid','failed','refunded');

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,    -- human-readable
  customer_id uuid references customers(id),
  branch_id uuid references branches(id),  -- fulfilling branch
  subtotal_kes numeric(10,2) not null,
  vat_kes numeric(10,2) default 0,         -- 16% if VAT-registered
  total_kes numeric(10,2) not null,
  status order_status default 'pending_payment',
  payment_method payment_method,
  payment_status payment_status default 'pending',
  mpesa_ref text, pesapal_id text,
  promo_code text, discount_kes numeric(10,2) default 0,
  shipping jsonb,                          -- name/phone/address/county
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity int not null,
  unit_price_kes numeric(10,2) not null,
  lens_option text                          -- SingleVision/Bifocal/Progressive + coating
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  branch_id uuid references branches(id),
  type text,                                 -- EyeTest, FrameFitting, Consultation
  scheduled_at timestamptz not null,
  status text default 'pending',             -- pending/confirmed/rescheduled/cancelled
  notes text,
  created_at timestamptz default now()
);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  order_id uuid references orders(id),
  file_url text,                             -- Supabase Storage
  sphere_od numeric, sphere_os numeric,
  cyl_od numeric, cyl_os numeric, axis_od int, axis_os int,
  pd numeric,
  status text default 'pending',             -- pending/processed
  created_at timestamptz default now()
);

create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  customer_id uuid references customers(id),
  rating int check (rating between 1 and 5),
  body text,
  status text default 'pending',             -- pending/approved/flagged
  admin_reply text,
  created_at timestamptz default now()
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null,               -- percent | fixed
  value numeric(10,2) not null,
  category_id uuid references categories(id),
  max_uses int, uses int default 0,
  expires_at timestamptz,
  is_active boolean default true
);

create table mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  mpesa_ref text unique not null,
  amount_kes numeric(10,2) not null,
  customer_phone text,
  raw jsonb,                                 -- Daraja callback payload
  order_id uuid references orders(id),       -- nullable until matched
  status text default 'unmatched',           -- unmatched/matched/reversed
  received_at timestamptz default now()
);

create table pesapal_transactions (
  id uuid primary key default gen_random_uuid(),
  pesapal_order_id text unique not null,
  amount_kes numeric(10,2),
  method text,                               -- Visa/MC/AirtelMoney/Bank
  raw jsonb,
  order_id uuid references orders(id),
  status text,
  received_at timestamptz default now()
);
```

### 5.2 Row-Level Security (sketch)

- `products`, `categories`, `branches`: `select` open to anon; `insert/update/delete` super_admin only.
- `customers`: customer can `select/update` their own row; super_admin all.
- `orders`, `order_items`, `prescriptions`: customer can `select/insert` their own; super_admin all.
- `appointments`: customer can `insert` & `select` own; super_admin all.
- `product_reviews`: customer can `insert`; only approved rows visible to anon; super_admin moderates.
- `mpesa_transactions`, `pesapal_transactions`: super_admin only; service-role JWT writes from webhooks.
- `auth.users.user_metadata.role` carries `'super_admin'` claim, checked in a `is_admin()` SQL helper.

### 5.3 Supabase Storage buckets

| Bucket           | Purpose                           | Public read?              |
| ---------------- | --------------------------------- | ------------------------- |
| `product-images` | PDP gallery                       | yes                       |
| `tryon-assets`   | transparent PNG cutouts for AR    | yes                       |
| `prescriptions`  | uploaded prescription PDFs/images | **no** (signed URLs only) |
| `promo-banners`  | banner artwork                    | yes                       |

### 5.4 Node.js / Express REST API (or Next.js route handlers)

Decision point — see §6.

Required endpoints:

```
# Customer
POST   /auth/signup                       (proxy to Supabase Auth)
POST   /auth/login
POST   /auth/logout
GET    /products?category=&search=&filters
GET    /products/:slug
GET    /branches
POST   /cart (server-side persistence keyed to customer)
GET    /cart
POST   /orders                            (creates order, returns payment intent)
POST   /payments/mpesa/initiate           -> Daraja STK Push
POST   /payments/mpesa/callback           -> Daraja webhook
POST   /payments/pesapal/initiate         -> redirect URL
POST   /payments/pesapal/ipn              -> Pesapal IPN
GET    /orders/:id/tracking
POST   /appointments
POST   /prescriptions/upload              -> signed Storage URL
POST   /reviews

# Admin (super_admin only)
GET/POST/PUT/DELETE /admin/products
PATCH  /admin/inventory
GET/PATCH /admin/orders/:id               (status workflow → triggers SMS)
GET/PATCH /admin/appointments/:id
GET    /admin/customers
GET/PATCH /admin/prescriptions
GET/PATCH /admin/reviews
GET/POST/PATCH /admin/promotions
GET/PUT /admin/branches
GET    /admin/payments/mpesa
POST   /admin/payments/mpesa/reconcile
```

### 5.5 Third-party integrations

| Concern                                   | Provider                                          | Reason                                     |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| Payments — M-Pesa                         | Safaricom **Daraja API** (STK Push C2B)           | SOW §2.1 / §3.2                            |
| Payments — Cards / Airtel Money / Bank    | **Pesapal**                                       | SOW §2.2                                   |
| Payments — fallback / Visa-MC via Pesapal | (covered above)                                   | —                                          |
| SMS                                       | **Africa's Talking** (preferred for KE) or Twilio | SOW order/appt confirmations               |
| Email                                     | Resend or SendGrid                                | Order confirmation                         |
| Maps                                      | Google Maps JS API                                | Branch locator + appointment branch picker |
| Face mesh (Phase 3 web)                   | MediaPipe Face Mesh                               | Notion try-on plan                         |
| Face detection (Phase 3 app)              | Google ML Kit                                     | Notion try-on plan                         |
| Analytics                                 | GA4 + GTM                                         | SOW                                        |
| Tax (optional)                            | eTIMS (KRA) — flagged in Risks page               | Open decision                              |

---

## 6. Recommended target architecture

A pnpm/turborepo monorepo:

```
optex/
├─ apps/
│  ├─ web/                Next.js 14 (App Router) — customer storefront
│  ├─ admin/              Next.js 14 (App Router) — super-admin panel
│  └─ api/                Node.js + Express (Vercel serverless) — optional split
├─ packages/
│  ├─ ui/                 shadcn primitives (shared between web + admin)
│  ├─ db/                 Supabase types (generated) + RLS helpers
│  ├─ payments/           Daraja + Pesapal SDK wrappers
│  └─ config/             tailwind preset + brand tokens
└─ supabase/
   ├─ migrations/         versioned SQL
   └─ seed.sql
```

**One open decision:** keep Express as a separate `apps/api` service (SOW words "Node.js + Express"), or use Next.js route handlers for everything (simpler, fewer deploy targets, same Node runtime).

- **Recommendation:** Next.js route handlers for everything except the M-Pesa/Pesapal webhooks, which run as **Vercel serverless functions** so the public URL is stable & isolated from app deploys. This still satisfies "Node.js + Express" in spirit (Express can be mounted under a single Vercel function if the client requires the literal name).

---

## 7. Mobile + desktop responsive plan

Tailwind breakpoint policy across both apps:

| Token   | Width  | Use for                                                              |
| ------- | ------ | -------------------------------------------------------------------- |
| default | 0px+   | Single-column phone (Kenya: Android, often 360-414px)                |
| `sm:`   | 640px  | Large phone / small landscape                                        |
| `md:`   | 768px  | iPad portrait — **must explicitly handle** (current code skips this) |
| `lg:`   | 1024px | iPad landscape / small laptop                                        |
| `xl:`   | 1280px | Desktop                                                              |
| `2xl:`  | 1536px | Large desktop                                                        |

Rules:

1. Every page declares mobile layout first, then progressively enhances at `md:` and `lg:`. No `lg:`-only overrides.
2. No magic-number paddings tied to header height — header height becomes a CSS custom property (`--header-h`) set on `:root`.
3. `<Image>` from `next/image` for every product asset; remove all bare `<img>` post-migration.
4. Admin gets a `Sheet`-based drawer for `<md` so the sidebar is hidden behind a hamburger; today's fixed `w-64` is unusable on iPad.
5. All form fields get `htmlFor` + `id` pairing (a11y baseline).
6. Strip `overflow-x-hidden` from `MainLayout` — surface the real overflow bugs and fix them.

---

## 8. Phased plan to ship the Kenya SOW (8 weeks)

This re-orders the Notion plan against the current state — **the current code is essentially zero-day for SOW purposes**, so the schedule below assumes a fresh Next.js monorepo build.

| Week  | Work                                                                                                                                                                | Deliverable                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **1** | Monorepo init · Supabase project + schema migrations · brand tokens + Tailwind preset · Figma design approval                                                       | DB schema live, design approved |
| **2** | Next.js scaffolds (web + admin) · Supabase Auth · header/footer · home shell · admin login + sidebar layout · Catalog page wired to Supabase                        | Dev env live                    |
| **3** | Category pages, PLP filtering, PDP, search (Supabase FTS) · admin Products + Inventory · cart wired to Supabase                                                     | Catalog UI complete             |
| **4** | Checkout · Daraja STK Push + callback · Pesapal redirect + IPN · COD path · Order creation + status machine                                                         | Payments live                   |
| **5** | Admin Orders/Appointments/Customers · Africa's Talking SMS triggers · Prescription upload + Storage signed URLs · admin Dashboard charts                            | Admin v1                        |
| **6** | Reviews + JSON-LD (Product/LocalBusiness/MedicalOrganization/FAQ) · Promotions engine · Branch locator + Google Maps · Appointment wizard · AR Try-On scope confirm | Full feature set                |
| **7** | SEO schema · Core Web Vitals (LCP<2.5s) · UAT (web + Android) · Vercel + Cloudflare DNS cut-over · bug fixes                                                        | GO-LIVE                         |
| **8** | Play Store submission · training docs · handover                                                                                                                    | Published + handover            |

(Flutter Android app runs Weeks 3-7 in parallel — not in scope of this repo audit.)

---

## 9. Top risks (from Notion `⚠️ Risks` page)

| Risk                                                 | Status           | Mitigation                                                            |
| ---------------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| Daraja / Pesapal credentials not delivered by Week 1 | 🔴 Open          | Lock credentials in kickoff; have sandbox-only fallback for Weeks 1-3 |
| Product catalog spreadsheet not delivered Week 1     | 🔴 Open          | Use seed fixtures until Week 2; gate PDP UAT on real data             |
| Frame PNG cutouts for Try-On (Phase 3)               | 🔴 Open          | Start Month 8, not Month 10                                           |
| Budget-Android Try-On perf                           | 🟡               | 15 fps "Lite Mode" toggle                                             |
| KRA eTIMS integration                                | 🟡 Open decision | Confirm at kickoff                                                    |
| iOS app / Try-On for iOS                             | 🟡 Open decision | Confirm out-of-scope in writing                                       |

---

## 10. Bottom line

1. **Treat the current repo as scaffolding, not production code.** Keep the Tailwind tokens, the shadcn `ui/*` primitives, the page-component visual layouts, and the TypeScript interfaces. Rebuild everything else in a Next.js 14 monorepo.
2. **Build the Supabase schema first** (Week 1) — every screen on both apps depends on it.
3. **Webhook isolation matters**: Daraja and Pesapal callbacks need a stable public URL distinct from the Next.js app deploy URL. Use Vercel serverless functions under a fixed path (`/api/webhooks/mpesa`, `/api/webhooks/pesapal`).
4. **Mobile-first is non-negotiable** — 70%+ of Kenyan traffic is on mobile, and the SOW pins LCP < 2.5s. CRA cannot deliver this.
5. **Two SOW versions exist** — implement against the **Kenya v3.0**. If you reference the India v1.0 by mistake, you'll build Razorpay/UPI instead of M-Pesa/Pesapal and lose the entire payment integration.

---

## 11. Legacy `Frontend/` — archived as read-only reference

`Frontend/optex-admin/` (Vite 6 SPA) and `Frontend/optex-web/` (CRA) are **frozen**. They exist in this repo as a visual/component reference only.

**Do not add features, fix bugs, or deploy from `Frontend/`.** All active development happens in `apps/web/`, `apps/admin/`, `apps/api/`, and `packages/`.

The `Frontend/` directory has its own `.git` repository (`.git` lives at `Frontend/`, not the repo root) and is excluded from the root `.gitignore` to prevent it from being tracked twice. Do not run git commands from the root for changes inside `Frontend/` — use `git -C Frontend/` if you need to inspect its history.

**What to mine from `Frontend/` (read-only):**

- Visual layout and spacing from page components (`src/app/components/admin/*.tsx`, `src/pages/*.jsx`)
- shadcn `ui/*` primitives already adapted to the OPTEX colour palette
- TypeScript interfaces for `Product`, `Order`, `Appointment`, `Customer`

**What to ignore:**

- Build pipeline (Vite, react-scripts, Firebase Hosting config)
- `src/imports/` (raw Figma-Make export, never integrated into App.tsx)
- `figma:asset/` Vite plugin and the missing `src/assets/` directory
- MUI dependency (unused, dead weight)
- State-machine routing in `App.tsx` (`currentPage` union + switch)
