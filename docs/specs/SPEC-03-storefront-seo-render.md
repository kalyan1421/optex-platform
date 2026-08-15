# SPEC-03 — Storefront SEO & Render Rewrite

**Date:** 2026-08-07 · **Status:** Ready to build (prerequisites first) · **Owner:** Intern A
**Blocked on client:** No, except catalogue *content*. The rewrite itself needs nothing from them.
**Source:** [ROADMAP TD-3, D.1 Wave 5](../ROADMAP.md), [FEATURE-STATUS §11](../FEATURE-STATUS.md)

---

## Problem Statement

SEO and Core Web Vitals are **contracted deliverables under OPTEX-SOW-2025-001-KE v3.0**, and they are currently unmet on precisely the pages that matter. 23 of the storefront's page and layout files are client components; the product detail page fetches its data in `useEffect` from the browser and injects its Product JSON-LD *after hydration*, where crawlers that do not execute JavaScript will not see it. `generateMetadata` appears exactly once in the entire app — on the category page. There is no `sitemap.xml` and no `robots.txt`.

For a 27-branch optician competing on local search in Kenya, organic discovery is the primary acquisition channel. A storefront that renders its product data only in the browser is invisible to the queries that would bring customers to it. This is not a polish item; it is a contracted deliverable that is currently not delivered.

## Goals

1. **Every product and category page is fully server-rendered**, with its title, description, Open Graph tags and structured data present in the initial HTML response.
2. **Search engines can discover every product** via a sitemap, and are told what to crawl via robots.
3. **Core Web Vitals pass** on the pages that carry organic traffic.
4. **No regression in storefront behaviour** — this is a rewrite of how pages render, not what they do.
5. **The storefront becomes type-checked**, closing the gap where a typed API client is consumed by 38 untyped `.jsx` files.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Content SEO — keyword research, copywriting, backlinks | Different discipline, not an engineering deliverable. Flag separately if the SOW implies it. |
| Rewriting auth pages as Server Components | They are interactive by nature and carry no SEO value. |
| Migrating session handling off Supabase | [ROADMAP D.4](../ROADMAP.md) recommends stopping at auth-only, and that reasoning holds. |
| Full accessibility audit | Related and worth doing, but a separate scope that would swallow this one. |
| A CDN or image-optimisation pipeline | Revisit after measuring; do not assume the bottleneck. |
| GA4 / analytics instrumentation | Genuinely absent ([FEATURE-STATUS §9](../FEATURE-STATUS.md)) and needed to *measure* this work — but it is a separate, smaller piece. Sequence it **before** this spec ships so there is a baseline. |

## User Stories

### Prospective customer

- As someone searching "prescription glasses Nairobi", I want Optex products to appear in results, so that I can find them at all.
- As someone who clicked a product link, I want the page to show content immediately rather than a loading state, so that I do not bounce.
- As someone sharing a product on WhatsApp, I want a preview with the product image, name and price, so that the link is worth sending. *(WhatsApp does not execute JavaScript — this fails completely today.)*

### Optex

- As Optex, I want product pages eligible for Google rich results with price and availability, so that listings are more prominent than competitors' plain links.
- As Optex, I want new products discoverable by search engines without manual submission.

### Engineering

- As a developer, I want the storefront type-checked against the API client, so that a contract change is a build error rather than a customer-facing runtime failure.

### Edge cases

- A product slug that does not exist → proper 404 with correct status code, not a client-side empty state.
- A deactivated product that was previously indexed → correct status and removal from the sitemap.
- Out-of-stock products → structured data availability must be accurate ([SPEC-02 R2](SPEC-02-checkout-fulfilment.md) dependency).
- A catalogue large enough to exceed sitemap size limits.

## Requirements

### P0 — Must have

**R1. SSR-capable API client (gap G-7).**
`web/lib/api.js` is marked `'use client'`, so Server Components cannot call it. **Every other requirement in this spec depends on this one.** It is small and it is a hard prerequisite — do not underestimate it, and do not start R2 before it lands.

- [ ] A Server Component can call the API server-side without pulling in client-only code
- [ ] The browser client keeps working unchanged for interactive components
- [ ] Server-side calls do not leak credentials into the client bundle

**R2. Catalogue pages become Server Components.**
`shop`, `product/[slug]`, `search`, and the three data-driven home components. `category/[slug]` is already a Server Component and is the reference pattern.

All done. `shop` and `product/[slug]` converted in Sprint 5 (the PDP split into four client islands: `ProductPurchasePanel`, `ProductTabs`, `ReviewForm`, `SimilarProducts`). Sprint 6 converted the rest: `search/page.jsx` (reads `?q=` via the `searchParams` prop instead of the client `useSearchParams` hook — no more `<Suspense>` boundary needed — split into `SearchBox` and `SearchResults`); the three home sections `FeaturedCollection` (+ `FeaturedCollectionTabs`), `FeaturedProducts` (+ `FeaturedProductsGrid`), and `TrendingNow` (no client split needed — no Add to Cart button on that grid, so it renders fully server-side); and `category/[slug]`, which was already a Server Component but read Supabase directly — swapped to `publicApi()` via a new `GET /categories/:slug` endpoint (R7), closing gap G-5 and the last direct-Supabase-read site in the storefront's page tree.

Sprint 6 also fixed a live bug found while making this change: `categories` has no `description` column (confirmed directly against the schema), so `category/[slug]`'s old `.select('id, name, slug, description')` errored on every request and the page 404'd unconditionally before this pass. Not a regression risk to track — it's fixed, and Sprint 6's own verification (`curl` returning 200 with real product data) is the proof.

- [x] Product data is present in the initial HTML, verified by fetching with JavaScript disabled — confirmed via `curl` on `product/[slug]`, `search`, `category/[slug]`, and the home page (product names, prices, and links present with no JS execution)
- [x] Interactive parts — filters, add-to-cart, review form — split into small client children — done for the PDP's purchase panel, tabs and review form; `shop`'s filters were already split in the earlier wave; `search`'s facets/sort/add-to-cart now live in `SearchResults`; the two home sections needing interactivity split into `FeaturedCollectionTabs` and `FeaturedProductsGrid`
- [x] Given a non-existent slug, then the response is a genuine HTTP 404 — true for both `product/[slug]` (`findBySlug()` → `NotFoundException` → `notFound()`) and `category/[slug]` (same pattern against the new `GET /categories/:slug`); confirmed with `curl` for both
- [x] No behavioural regression: every interaction working before still works — `smoke.spec.ts`, `checkout-authenticated.spec.ts`, `cart-empty.spec.ts` and `cart-merge.spec.ts` all pass unmodified (12/12) against the converted pages, plus manual walkthroughs of home (tab switching, add-to-cart), search (facets, sort, add-to-cart, no-results state), and category (previously-broken page now rendering real products)

**R3. Per-page metadata.**

- [x] `generateMetadata` on every product, category and static page — done for product (Sprint 5) and category; `shop` uses static `export const metadata`; search and static content pages remain
- [x] Product pages carry a unique title, description, canonical URL and Open Graph tags including the product image — `product/[slug]`'s `generateMetadata`, confirmed via `curl` (`<title>`, `<link rel="canonical">`, `og:title`, `og:image` all present)
- [x] Given a product page URL pasted into WhatsApp or Facebook, then a preview card renders with image, name and price — `openGraph.images` resolves to an absolute URL via the root layout's `metadataBase`; not verified against the live WhatsApp/Facebook crawler, only that the tags are correctly formed and resolvable
- [ ] No two indexable pages share a title — not re-audited across the whole site this pass

**R4. Server-rendered structured data.**

- [x] Product, Brand and Offer JSON-LD present in the initial HTML, not injected after hydration — confirmed via `curl` with JS disabled; also now includes `AggregateRating` once a product has approved reviews (not part of the original client-rendered version)
- [x] BreadcrumbList on product and category pages — done on `product/[slug]` (Sprint 5); `category/[slug]` does not yet emit it
- [x] Existing LocalBusiness and MedicalOrganization JSON-LD preserved — untouched, still in `layout.jsx`
- [ ] Validates clean against Google's Rich Results Test — not run this pass
- [ ] Availability reflects real stock (depends on [SPEC-02 R2](SPEC-02-checkout-fulfilment.md)) — still reflects `is_active` only, not a live stock count

**R5. Sitemap and robots.**

- [ ] `sitemap.xml` generated from live data, covering products, categories, branches and static pages
- [ ] Given a product is deactivated, then it leaves the sitemap on next generation
- [ ] `robots.txt` allows the storefront and disallows admin, API and account routes
- [ ] Sitemap handles catalogue growth beyond the single-file size limit

**R6. TypeScript conversion, in the same pass.**
The rewritten files are being rewritten anyway. Converting `.jsx` → `.tsx` separately is a hard sell and will never be prioritised on its own.

- [ ] Converted pages are `.tsx` and type-check against `@optex/api-client`
- [ ] `apps/web` has a `typecheck` script and it passes
- [ ] `typecheck` runs in CI

**R7. Category endpoint (gap G-5).** Done (Sprint 6) — `GET /api/categories/:slug` (`categories.controller.ts` / `categories.service.ts#findBySlug`), returning `404` for an unknown slug. `category/[slug]/page.jsx`'s `generateMetadata` and page body both use it in place of the direct-Supabase lookup.

**R8. Enforcement.**

- [ ] ESLint `no-restricted-imports` bans `@optex/db` outside `middleware.*`, `lib/api.*` and the auth pages
- [ ] Given a PR reintroducing a direct browser Supabase read, then CI fails

### P1 — Should have

- **R9.** FAQ page with FAQPage schema — both the page and the schema are absent, and FAQ rich results are high-yield for local retail.
- **R10.** Image optimisation on product images (measure first).
- **R11.** Per-branch landing pages with LocalBusiness schema. 27 branches is 27 local-search entry points, currently unexploited. Blocked on branch coordinates ([D1/D2](../CLIENT-QUESTIONS.md)).

### P2 — Future considerations

- Hreflang, if the client ever wants Swahili.
- ISR / cache revalidation strategy — R2 should choose a caching approach that can be tuned later without another rewrite.
- Product review schema with aggregate ratings, once real review volume exists.

## Success Metrics

**Leading (at merge, then weekly for 4 weeks):**

| Metric | Success | Method |
| --- | --- | --- |
| Indexable pages with unique title + description | 100% | Crawl |
| Product data present with JS disabled | 100% of PDPs | Manual + automated check |
| Rich Results Test errors | 0 | Google tool |
| LCP on PDP (mobile) | < 2.5s | Lighthouse CI |
| Pages indexed in Search Console | Rising weekly | Search Console |

**Lagging (90 days post-launch, requires GA4 first):**

| Metric | Success | Stretch | Method |
| --- | --- | --- | --- |
| Organic sessions | Baseline established, then growth | +50% by day 90 | GA4 |
| Products ranking for brand + product queries | > 50% of catalogue | > 80% | Search Console |
| Organic → cart conversion | Baseline | Above site average | GA4 |
| Core Web Vitals "Good" URLs | > 90% | 100% | Search Console |

**Measurement gap worth naming:** there is no analytics on the site at all today. Without GA4 in place first, none of the lagging metrics can be measured, and the SOW's SEO deliverable cannot be evidenced to the client. **Install analytics before this ships, not after.**

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Is `apps/web` converting to TypeScript? [ROADMAP Part F](../ROADMAP.md) asks and it is unanswered | Kalyan | **Yes** for R6 |
| Q2 | Production domain and hosting — canonical URLs, sitemap host and CWV all depend on it | Client ([D4, D5](../CLIENT-QUESTIONS.md)) | **Yes** before launch, not before build |
| Q3 | Google Analytics account | Client ([D9](../CLIENT-QUESTIONS.md)) | No for build, **yes** to evidence the deliverable |
| Q4 | Two homepage sections need a content decision before indexing: invented Western testimonials on a Kenyan storefront, and a Virtual Try-On section advertising a Phase 3 feature that does not exist | Client ([E2, E3](../CLIENT-QUESTIONS.md)) | No, but **must not be indexed as-is** — advertising a non-existent feature in indexed content is a real problem |
| Q5 | Caching strategy: full SSR, or ISR with revalidation? Affects cost and freshness | Engineering | No — decide during R2 |

## Timeline Considerations

**Hard prerequisite: CI and a smoke suite must exist first.** [ROADMAP D.3](../ROADMAP.md) is right that rewriting the storefront's render model with zero regression protection is the riskiest thing on the plan, and [CODE-REVIEW](../CODE-REVIEW.md) is evidence of what ships unnoticed when nothing tests it. Do not start R2 without shop → PDP → cart → checkout covered.

**Sequence:** R1 (prerequisite) → R7 → R2 + R3 + R4 + R6 per page → R5 → R8 (last; worthless before, essential after).

**PR discipline:** one page per PR. Pair on the first one, then let the pattern carry. A single 2,000-line render-rewrite PR will not be reviewable and will sit.

**Contractual:** this is a signed SOW deliverable currently unmet. It should not be the phase that slips when something else runs late.

**Estimate:** 3 sprints (6 weeks), matching [TEAM-PLAN Phase III](../TEAM-PLAN.md). Expect it to use the full runway.
