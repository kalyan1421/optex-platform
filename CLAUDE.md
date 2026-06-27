# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

OPTEX is an eyewear retail platform for **Optex Opticians (Kenya)**. The binding contract is **OPTEX-SOW-2025-001-KE v3.0** — see [docs/AUDIT.md](docs/AUDIT.md) for the full audit; the India v1 SOW in the client's docs folder is **superseded** (different payment stack — Razorpay/UPI vs M-Pesa/Pesapal/COD).

Repo siblings at the root:

- `apps/web/` — Next.js 14 storefront (**new**, primary). Home, shop, PDP with JSON-LD, cart, login, signup. Server Components query Supabase via `@optex/db`. Middleware refreshes the Supabase session on every request.
- `apps/admin/` — Next.js 14 super-admin panel (**new**, primary). `(authed)` route group gated by `middleware.ts` requiring `user_metadata.role === 'super_admin'`. Dashboard, products, orders implemented; analytics/inventory/appointments/customers/prescriptions/reviews/promotions/branches/payments are placeholder pages pointing at the SOW week they ship.
- `packages/ui/` — shadcn primitives (Button, Card, Input, Label, Badge, Separator) + `cn` + `formatKes`, shared by both apps.
- `packages/db/` — Hand-derived Supabase types, browser/server/service client factories, query helpers. **Service client throws if imported on the client.**
- `packages/config/` — Tailwind preset with brand tokens (`brand.blue #2A3182`, `brand.red #E53935`, `brand.dark #1A1A2E`) + Montserrat font + CSS-variable theme tokens.
- `Backend/supabase/` — Schema, RLS, storage migrations, seed (0001-0003 + `seed.sql`).
- `docs/AUDIT.md` — Consolidated tech-debt audit, Figma-to-code comparison, Supabase plan, 8-week ship plan.
- `Frontend/optex-{web,admin}/` — **Legacy reference** (CRA + Vite). Do **not** add new features here. Mine for visual reference and shadcn primitives only; everything else has moved to `apps/` and `packages/`.

Pnpm workspace: `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. Bootstrap with `pnpm install` from the repo root. Dev servers: `pnpm dev:web` (port 3000) and `pnpm dev:admin` (port 3001).

**Both legacy frontends are misaligned with the SOW stack** (SOW requires Next.js 14 + Node/Express + Supabase + Vercel; legacy has CRA web + Vite admin + Firebase Hosting). See AUDIT.md for the migration rationale.

The two frontends are **independent apps with different tooling stacks** — do not assume conventions in one carry over to the other. They are also deployed to **different Firebase Hosting projects**: admin → `optex-adminpanel`, web → `optex-65423` (see each app's `.firebaserc`).

Only the `Frontend/` tree is a git repo (`.git` lives at `Frontend/`, not the repo root). Run git commands from `Frontend/`. The new `Backend/` and `docs/` trees are not yet under version control.

## Backend (Supabase)

Schema, RLS, and Storage buckets live in `Backend/supabase/migrations/` (`0001_init_schema.sql`, `0002_rls_policies.sql`, `0003_storage_buckets.sql`) with dev seed in `Backend/supabase/seed.sql`. See [Backend/README.md](Backend/README.md) for the Supabase CLI workflow (`supabase link` → `supabase db push`).

Auth model: Supabase Auth for customers; Super Admin is a single Supabase user with `user_metadata.role = 'super_admin'` checked by the `is_super_admin()` SQL helper. Payment webhooks (M-Pesa Daraja, Pesapal IPN) will use the service-role key to bypass RLS and write to `mpesa_transactions` / `pesapal_transactions`. Prescription files are namespaced by customer id under the private `prescriptions` bucket.

## optex-admin (admin panel)

Stack: **Vite 6 + React 18 + TypeScript + Tailwind CSS v4 + Radix UI + shadcn-style components + MUI**. Originally generated from Figma Make — see [Frontend/optex-admin/README.md](Frontend/optex-admin/README.md).

Commands (run from `Frontend/optex-admin/`):
- `npm run dev` — start Vite dev server
- `npm run build` — production build into `dist/`
- No test or lint script is configured.

Architecture notes:
- Entry: [src/main.tsx](Frontend/optex-admin/src/main.tsx) → [src/app/App.tsx](Frontend/optex-admin/src/app/App.tsx).
- **No router.** `App.tsx` holds a `currentPage` union-typed state and renders one of the page components from [src/app/components/admin/](Frontend/optex-admin/src/app/components/admin/) via a `switch`. To add an admin page: add the literal to the `Page` union, the case in `renderPage()`, and a corresponding entry in `AdminSidebar`.
- UI primitives live in `src/app/components/ui/` (shadcn-style wrappers around Radix). `@/` is aliased to `src/` in [vite.config.ts](Frontend/optex-admin/vite.config.ts).
- A custom Vite plugin `figmaAssetResolver` rewrites `figma:asset/<filename>` imports to `src/assets/<filename>`. **`src/assets/` does not currently exist** — any code using a `figma:asset/...` import will fail to build until those assets are added.
- Generated Figma exports live under `src/imports/` (one folder per screen, plus raw `.png` assets). Treat these as scaffolding; the canonical components are in `src/app/components/admin/`.
- Tailwind v4 is wired via `@tailwindcss/vite` (no `tailwind.config`). Theme tokens / CSS variables live in [src/styles/theme.css](Frontend/optex-admin/src/styles/theme.css) (light + `.dark` blocks); entry CSS is [src/styles/index.css](Frontend/optex-admin/src/styles/index.css).
- Deploy: `npm run build` then `firebase deploy` (hosts `dist/`).

## optex-web (customer storefront)

Stack: **Create React App (react-scripts 5) + React 19 + JavaScript/JSX + Tailwind CSS v3 + react-router-dom v7 + AOS scroll animations**. See [Frontend/optex-web/README.md](Frontend/optex-web/README.md).

Commands (run from `Frontend/optex-web/`):
- `npm start` — dev server on :3000
- `npm run build` — production build into `build/`
- `npm test` — Jest in watch mode (CRA). Run a single test with `npm test -- --testPathPattern=<name>` or `npm test -- -t "<test name>"`. No tests exist beyond the CRA default [App.test.js](Frontend/optex-web/src/App.test.js).

Architecture notes:
- Entry: `src/index.js` → [src/App.js](Frontend/optex-web/src/App.js). `App` initializes AOS once and wraps everything in `CartProvider` + `AppRoutes`.
- Routing: [src/routes/AppRoutes.jsx](Frontend/optex-web/src/routes/AppRoutes.jsx) defines all routes inside [MainLayout](Frontend/optex-web/src/layouts/MainLayout.jsx). A `ScrollToTop` effect resets scroll on route change.
- `MainLayout` conditionally hides `Header`/`Footer` on `/login` and `/signup`, and adjusts top padding for `/cart`, `/profile`, `/product` vs other inner pages vs `/` — when editing layout, check these branches together.
- **Global state**: [src/context/CartContext.js](Frontend/optex-web/src/context/CartContext.js) is the only context. It is seeded with three hard-coded cart items on every mount (no persistence, no API). When wiring real data, replace the `useState` seed and add persistence here rather than threading props.
- Pages live in `src/pages/<Name>/<Name>.jsx`; home-specific sub-sections live under `src/pages/Home/components/`. Shared layout chrome is under `src/components/layout/` (note `Footer.js` is JS; siblings are JSX — both work under CRA).
- Tailwind v3 config: [tailwind.config.js](Frontend/optex-web/tailwind.config.js) extends with brand tokens (`brand.blue #2A3182`, `brand.red #E53935`, `brand.dark #1A1A2E`) and Montserrat as the sans font. Prefer these tokens over raw hex when adding UI.
- `skills-lock.json` and `.agents/skills/` are Firebase Studio agent-skill metadata — they are not used at runtime.
- Deploy: `npm run build` then `firebase deploy` (hosts `build/`, SPA rewrite to `/index.html`).

## Cross-cutting

- No shared package, monorepo tooling, or workspace setup ties the two frontends together. Changes are independent.
- No backend / API client exists in either app. All product, cart, and user data is fixture data. Any "save"/"submit" UI is non-functional today.
- The admin app's components were generated from a separate Figma file ("Complete Admin Panel Screens") than the storefront. The two apps do not share a design system in code.
