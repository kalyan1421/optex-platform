# OPTEX — Design Status (storefront)

**Date:** 2026-08-11 · **Code:** `main` @ `e8cfcec` · **Design:** [Figma — Asan](https://www.figma.com/design/5v5DiZT9edTjl7Yg9ULUyK/Asan?node-id=0-1), file key `5v5DiZT9edTjl7Yg9ULUyK`, single page `final`

**Scope: storefront only.** The admin panel is deliberately excluded — it is built against shadcn primitives with no Figma source, and is not part of this gap analysis.

**Companion to** [FEATURE-STATUS.md](FEATURE-STATUS.md), which answers *what is built*. This doc answers *what is drawn*, and where the two disagree.

**Method:** the Figma file was read directly via the desktop bridge and every top-level frame enumerated. Route coverage was cross-referenced against the 23 `page.jsx` files in `apps/web/app`. Nothing here is inferred from a tracker.

> **Access note:** the remote Figma MCP rejects this file — the connected account has view, not edit, access. It was read through the local Figma desktop app instead. Anyone repeating this needs the file open in Figma desktop, or edit access granted.

---

## 1. What exists in Figma

19 top-level frames on the single `final` page.

### Screens

| Screen | Node | Size | Maps to |
| --- | --- | --- | --- |
| Home — `v1` | `0:214` | 1440×8079 | `/` |
| Home — `v2` | `0:740` | 1440×8079 | `/` |
| Home — `v3` | `0:1266` | 1440×8079 | `/` |
| Shop | `0:1831` → `0:1835` | 1440×3433 | `/shop` |
| Product Detail | `0:2177` → `0:2181` | 1440×2903 | `/product/[slug]` |
| Contact | `0:2480` → `0:2484` | 1440×2393 | `/contact` |
| Profile | `0:2679` | 1440×2404 | `/profile` |
| Cart | `0:3001` | 1440×1878 | `/cart` |
| Checkout | `0:3252` | 1440×1704 | `/checkout` |
| Login | `0:3500` | 1440×982 | `/login` |
| Signup | `0:3556` | 1440×1337 | `/signup` |
| About us | `413:490` | 1440×2881 | `/about` |
| Eye care | `413:825` | 1440×2890 | `/eye-care` |

The three Shop / Product Detail / Contact screens are each wrapped in a frame named `Complete Landing Page Sections`; the real screen is the `Body → Layout → Main Content` child named in the table above. The frame names are misleading — worth renaming in Figma.

### Components and tokens

| Item | Node | Note |
| --- | --- | --- |
| nav bar | `0:3614` | 1480×640, **4 variants** (`Default`, `Variant2`, `Variant3`, `Variant4`) |
| Top bar strip | `0:3763` | 1440×51 |
| Logo | `0:3791` | 112×93 |
| Colour + type swatches | `0:154`, `0:169`, `0:186` | `2E3192`, `1A1A1A`, `6C7AE0`, `8A8A8A`, `E0E0E0` |

> **No Figma Variables are defined in this file.** `get_variable_defs` returns empty at every node. The palette exists only as three swatch frames with hex values in the layer names, so there are no bound tokens for colour, spacing or type. Everything downstream is hand-transcribed — which is how `brand.blue #2A3182` in the Tailwind preset came to differ from `2E3192` in the design (see §6).

**Coverage: 11 of 23 built storefront routes have a design.**

---

## 1a. Per-page design detail

Measurements read from the Figma node tree. **Canvas is 1440 wide throughout; the content container is 1240** (100px gutters), except where noted.

### Home — `v1` (canonical, see §5) · `0:214` · 1440×8079

| Section | Node size | Inner container | Notes |
| --- | --- | --- | --- |
| `hero` | 1440×773 | 523×291 copy block | Full-bleed image 1143×762, overlay band 1442×276 |
| `Categories` | 1440×821 | 1240×60 header + 1143×561 grid | Heading 391×60, "view all" link 168×24 |
| `TrendingProductsSection` | 1440×584 | 1240×142 header + 1240×382 rail | |
| `ProductsSection` | 1440×1143 | 1240×92 header + 1240×780 grid | Tallest product block |
| `Frame 2610656` (deals) | 1440×504 | 481×504 copy + 697×467 image | Unnamed in Figma — rename to `DealsSection` |
| `FaceShapeSection` | 1440×878 | 1240×142 header + 1240×476 body | |
| `WhyChooseUsSection` | 1440×864 | 1240×664 | |
| `PromotionsSection` | 1440×500 | 2 × 604×500 | Two equal cards |
| `TestimonialsSection` | 1440×647 | 1240×94 header + 1240×333 body | **Contains the three invented reviews — see §4** |
| `CTASection` | 1440×607 | 537×607 + 500×500 · heading 1143×160 · 2 links 241×67 / 273×67 | Copy: "Join over 50,000+ satisfied customers…" |
| `Footer` | 1440×758 | 1240×259 top (logo 279 + 296 + 4×123 columns), 1240×146 mid, 1240×73 legal | |
| `nav bar` | 1440×135 | instance | |

### Shop · `0:1835` · 1440×3433

| Region | Size | Notes |
| --- | --- | --- |
| Hero banner | 1440×314 | |
| Content row | 1240×2106 | |
| ├ Filter sidebar | **250×552** | Categories block 250×236 · Brands block 250×284 — **only two facets, see §5** |
| └ Product area | **918×2106** | Header strip 918×36 (left: result count; right: an **empty slot**) + grid 918×2046 |
| Product card | 290×480 | 3-up grid, 24px gap; image box 288.4 tall |

### Product Detail · `0:2181` · 1440×2903

| Region | Size | Notes |
| --- | --- | --- |
| Breadcrumb | 1240×21 | Link / `/` / Link / `/` / current |
| Gallery + buy column | 1240×638 | 590×578 gallery, 590×638 buy panel |
| Tabs block | 1240×268 | 1240×51 tab bar + 1240×185 panel |
| Reviews / related | 1240×542 | 1240×89 header + 1240×312 body |

### Cart · `0:3001` · 1440×1878

| Region | Size |
| --- | --- |
| Cart list | 736×1011 — header 736×84, items 736×763, promo 736×145 |
| Order summary aside | 450×588 |
| Footer | 1440×552 (short variant — no mid band) |

### Checkout · `0:3252` · 1440×1704

| Region | Size |
| --- | --- |
| Multi-step accordion | 747×917 — section header 747×63 + body 747×818 |
| Order summary (static) | 461×893, inner card 461×775 |
| Footer | 1440×552 (short variant) |

### Profile · `0:2679` · 1440×2404

| Region | Size |
| --- | --- |
| Clinical profile header | 1253×335 — avatar 148×148 + detail 1161×243 |
| Bento grid | 1240×995 — prescription card 818×640, sidebar aside 395×661 |
| Order history table | 1240×277 |

### Login · `0:3500` · 1440×982 · Signup · `0:3556` · 1440×1337

Both use one 504-wide centred column: brand/heading 504×131, card (**493** login / **848** signup), footer link 504×29. The signup card is 355px taller for the extra fields.

### About us · `413:490` · 1440×2881

Hero 1440×481 with two 523×523 rounded borders and a 473×362 image; a 1277×340 two-up (532×183 copy + 643×340 image pair); a 1292×238 stat row of five bordered cards (415×238 and 4 × 415×115); CTA 1440×193; footer 1440×758. **Uses an 87px nav bar** (36px contact banner + 51px strip), not the 135px instance used elsewhere — see §6.

### Eye care · `413:825` · 1440×2890

Hero 1440×292 over a full-bleed image. Form column 786×1477: five stacked 333×73 fields (label 206×21 + input 333×44), one 706×73 two-up row, three toggle rows (207×52, 342×52, 342×52), a 684×418 group, a 684×170 textarea, and a 706×54 submit button ("Submit my eye record"). Right rail of three 437-wide cards: *Why fill this in advance* (437×288), *Store hours* (437×200), *Prefer to talk first?* (437×204). Same 87px nav bar as About.

### Contact · `0:2484` · 1440×2393

Hero 1440×354; body 1440×1145 with a 534-wide column (heading 534×48, paragraph 534×58, form 534×450) beside a 534×640 panel, then a full-width 1240×300 block.

---

## 2. Pending design — built, but never drawn

12 routes exist in code with no Figma screen. They were implemented against no visual spec.

| # | Route | What it contains today | Priority |
| --- | --- | --- | --- |
| 1 | `/appointments` | Slot picker, branch selector, date/time, confirmation. Backed by `GET /appointments/slots`, `assertSlotBookable()` and confirmation + reminder SMS. **A core SOW feature, fully built, entirely undesigned** | **P0** |
| 2 | `/orders/[id]/tracking` | 6-stage `order_status` timeline | **P0** |
| 3 | `/order-confirmation/[orderId]` | The screen the customer lands on immediately after paying | **P0** |
| 4 | `/search` | Full-text results over the `search_tsv` GIN index | P1 |
| 5 | `/branch-locator` | List of 27 branches. The map is unbuilt *and* undesigned, and no branch has coordinates | P1 |
| 6 | `/category/[slug]` | The only Server Component in the app, and the SEO landing surface | P1 |
| 7 | `/forgot-password` | Supabase-native flow | P2 |
| 8 | `/reset-password` | Supabase-native flow | P2 |
| 9 | `/privacy` | ~251 lines of copy in a generic layout | P2 |
| 10 | `/returns` | ~175 lines. **Copy is also wrong** — client confirmed no refunds | P2 |
| 11 | `/delivery` | ~196 lines. **Copy is also wrong** — contradicts the confirmed delivery model | P2 |
| 12 | `/warranty` | ~157 lines | P2 |

**Sequencing note for 9–12:** Returns and Delivery need a content rewrite regardless ([NEXT-PLAN M2](NEXT-PLAN.md)). Design and copy should land in the same pass rather than designing a page whose text is about to be replaced.

### 2a. What each pending page has to contain

A designer can work from this without reading the code. All measurements assume the established 1440 canvas / 1240 container and the 135px nav + 758px footer already in the file.

**1 · `/appointments` — P0.** Four states on one page: branch picker (27 branches, grouped by town), date picker, slot grid, and a details form (name, phone, email, appointment type). Slots come from `GET /appointments/slots` and must render three states — available, taken, outside branch hours. Type is a fixed enum (`eye_test` and siblings). Needs a success state showing the confirmed slot, and an error state for "That slot is already booked", which the API returns as a real outcome. Guests can book, so the form must work signed-out. Reference the Eye care form (`413:825`) — same 333×73 field rhythm.

**2 · `/orders/[id]/tracking` — P0.** A 6-stage horizontal timeline driven by the `order_status` enum, with the current stage emphasised and future stages muted. Plus order summary, line items, delivery address, and payment method/reference. Must handle a cancelled order, which exits the timeline early.

**3 · `/order-confirmation/[orderId]` — P0.** The post-payment landing page: confirmation mark, order number, itemised total (subtotal / shipping / VAT / total), payment method, expected delivery, and two exits — "track order" and "continue shopping". Needs a distinct pending-payment variant, because M-Pesa STK confirms asynchronously and the customer can land here before the callback arrives.

**4 · `/search`.** Results grid reusing the Shop card (290×480), a result count, an empty state ("no matches for X"), and the query echoed back. Should share the Shop filter sidebar now that one exists (§5).

**5 · `/branch-locator`.** List/detail of 27 branches: name, address, phone, manager, per-weekday hours. A map is the obvious treatment but **no branch has coordinates yet**, so design the list-only state as the shipping default and the map as an enhancement.

**6 · `/category/[slug]`.** SEO landing page — category hero, description copy, product grid. This is the only Server Component, so it must render fully without client JS.

**7–8 · `/forgot-password`, `/reset-password`.** Reuse the 504-wide auth column from Login (`0:3500`). Each needs request, sent, success and expired-token states.

**9–12 · Policy pages.** One shared template: title, last-updated date, and a long-form prose column. Use a narrower measure than 1240 — 680–760 is the readable range for body copy at this type size.

### 2b. Missing add-ons on pages that *are* designed

Screens exist, but these elements within them do not:

| Page | Missing element | Why it's needed |
| --- | --- | --- |
| Shop | ~~Price / shape / gender / material facets, sort~~ | **Built this session — see §5.** Still needs adding to Figma |
| Shop | Pagination or infinite scroll | The design shows 10 cards; the query caps at 100 with no paging UI |
| Shop / Search | Empty state | No "no products match" treatment exists |
| Product Detail | Lens / coating configurator | Contracted ([SPEC-07](specs/SPEC-07-lens-configurator.md)). The PDP currently emits a fixed `Lens: Standard` |
| Product Detail | Stock / availability indicator | `inventory` exists per branch; nothing surfaces it |
| Cart | Empty-cart state | |
| Cart | Guest-cart-merge prompt at sign-in | The guest cart is silently discarded today |
| Checkout | Pickup-station picker | [SPEC-02](specs/SPEC-02-checkout-fulfilment.md), blocked on client B1–B3 |
| Checkout | M-Pesa STK "waiting for confirmation" state | The customer waits on their phone; the design has no waiting state |
| Profile | Saved addresses, reorder, cancel-order | All absent in design and code |
| Nav bar | Search input / autocomplete | Nav has 4 variants, none with a search field |
| Global | Mobile / tablet breakpoints | **Every frame is 1440 desktop only.** No responsive spec exists for any page |

> The last row is the largest single omission in the file. The storefront is implemented responsively, but every breakpoint below 1440 was a developer judgement call with no design behind it.

---

## 3. Needs design before it can be built

Features with **neither** a Figma screen nor an implementation. Each needs design first, so none can be scoped as "just build it".

| Feature | Contracted? | Note |
| --- | --- | --- |
| **Lens / coating configurator** | Yes — [SPEC-07](specs/SPEC-07-lens-configurator.md) | The largest missing surface. No design, and no price model to design against. The PDP currently emits a fixed `Lens: Standard` string into the cart |
| **Filters — price, frame shape, gender, material** | Phase 1A | See §5. The Shop design specifies only Categories and Brands, so this is a design gap first |
| **Sort control** | Phase 1A | Present in code (`shop/page.jsx`), absent from the Shop design |
| **Pickup-station picker** | Yes — [SPEC-02](specs/SPEC-02-checkout-fulfilment.md) | Blocked on client answers B1–B3 |
| **Guest-cart merge prompt** | No | The guest cart is discarded at sign-in; any fix needs a UX decision (merge silently, or ask) |
| Wishlist / favourites | No | Zero layers in Figma. An implementation exists on the `archive/venky-optex` tag |
| Product comparison | No | |
| Search autocomplete | No | An implementation exists on `archive/venky-optex` |
| FAQ page | No | "FAQs" exists only as a footer link in the design |
| Saved addresses · Reorder · Customer order cancel | No | Account-area gaps |

---

## 4. Design-origin defects

**Several fabricated-data defects fixed in `70c2d6c` originate in the Figma file, not in the code.** The developer implemented the design's placeholder copy literally. Confirmed as layer text in the file:

| Placeholder in Figma | Where it surfaced in code | Fixed in code? | Fixed in Figma? |
| --- | --- | --- | --- |
| `+91 9876543210` | Top bar on every page of a Kenya-only storefront | ✅ → `+254 700 000 000` | ❌ **Still in the design** |
| `Oakley`, `Rayban`, `Silhouette`, `Tommy Hilfiger` | Source of the `'OAKLEY'` brand fallback on PDP, Featured Collection and Trending Now | ✅ → neutral `—` | ❌ **Still in the design** |
| `(124 Customer Reviews)` | PDP review count for products with zero reviews | ✅ → "No reviews yet" | ❌ **Still in the design** |
| `Frame: Midnight Matte \| Lens: Blue Light Filter` | Invented frame colour and lens coating on cart lines | ✅ → renders only when real | ❌ **Still in the design** |
| `KSH. 129.99`, `KSH. 89.99`, `KSH. 180.00` | A dollar-scale price ladder relabelled KSH. Real seeded frames are KES 26,000–32,000 | n/a — real prices come from the DB | ❌ **Still in the design** |

**This is the highest-value item in this document.** The code is clean, but the design is not, so the next person implementing a screen from Figma reintroduces the same class of defect. The file needs one cleanup pass replacing sample content with either real Optex data or obviously-placeholder tokens (`{{brand}}`, `{{review_count}}`).

The price ladder deserves particular attention: it suggests the design was laid out against a USD price scale and relabelled, so column widths and type sizes were never tested against five-digit KES figures.

---

## 5. Decisions

**1. `v1` is canonical. — DECIDED 2026-08-11.** `v1` (`0:214`), `v2` (`0:740`) and `v3` (`0:1266`) are all 1440×8079 with **identical** section lists. `v1` is the reference; `v2` and `v3` should be archived or marked deprecated in Figma so no one builds from them. Per-section measurements for `v1` are in §1a.

**2. Shop filters — BUILT 2026-08-11, still pending in Figma.** The Shop screen specifies only **Categories** and **Brands**, but `products.frame_shape`, `gender` and `frame_material` have existed since `0001` and were unused. The filters are now implemented in `apps/web/app/shop/page.jsx`:

| Facet | Behaviour |
| --- | --- |
| Price | Five bands — All / under 10k / 10–20k / 20–30k / over 30k. Bands rather than a dual-thumb slider, because the sidebar has one established control (a list of selectable rows) and a slider is a new component with no design behind it |
| Frame shape | Distinct `frame_shape` values |
| Gender | Distinct `gender` values |
| Material | Distinct `frame_material` values |
| Sort | Featured / price ↑ / price ↓ / name A–Z, placed in the **empty 918×36 header slot the design already leaves** at the top-right of the product area |

Two behaviours worth carrying into the Figma version:

- **A facet hides itself when the catalogue has fewer than two distinct values.** With the current seed every product is `unisex`, so the Gender block correctly does not render. Without this, a thin catalogue shows dead controls.
- **Facet values are grouped case-insensitively.** The seed alone contains both `Metal` and `metal`, which would otherwise render as two rows that each filter out the other's products.

Also added: a "Clear all filters (n)" control, shown only when a filter is active.

**Still needed in Figma:** the four facet blocks and the sort control, drawn into `0:1835`. The implementation follows the existing block pattern exactly — 250px wide, heading with a hairline rule, 40px selectable rows, `#2E3192` active fill — so it can be traced from the running page.

**3. Frame naming.** Three unrelated screens are all called `Complete Landing Page Sections`, and the real screen is two levels down. Renaming to `Shop`, `Product Detail` and `Contact` costs minutes and removes a recurring source of confusion.

---

## 6. Design-system inconsistencies

Found while measuring. None block work, all cause drift.

**1. Two competing navies are live in the codebase.** The design uses `#2E3192`. The Tailwind preset (`packages/config/tailwind.preset.js:28`) defines `brand.blue` as `#2A3182`. Both are in use in the storefront right now — **20 files reference `#2A3182`, 15 reference `#2E3192`** — so two near-identical blues render side by side. Pick one, put it in the preset, and replace the hardcoded hexes. With no Figma Variables defined there is nothing enforcing either value.

**2. Two nav bar heights.** Home, Shop, PDP, Cart, Checkout and Profile use the 135px `nav bar` instance (`0:3614`). About us and Eye care use an 87px nav built from a 36px contact banner plus a 51px strip. Both ship. One is wrong.

**3. The nav bar has 4 variants and no documented meaning.** `Default`, `Variant2`, `Variant3`, `Variant4` — the names carry no information about when each applies.

**4. Colours are layer names, not styles.** `2E3192`, `1A1A1A`, `6C7AE0`, `8A8A8A`, `E0E0E0` exist as text labels in three swatch frames. Nothing in the file binds them to fills, so a colour change requires hand-editing every usage.

**5. Two footer heights.** 758px on most pages, 552px on Cart and Checkout (the mid band is dropped). Probably deliberate; undocumented either way.

---

## Summary

| | Count |
| --- | --- |
| Built storefront routes | 23 |
| **Routes with a design** | **11** |
| **Routes pending design** | **12** |
| Missing add-ons inside designed pages | 12 |
| Features needing design before build | 10 |
| Design-origin defects fixed in code but still live in Figma | 5 |
| Design-system inconsistencies | 5 |
| Breakpoints designed | **1** (1440 desktop only) |

**The gap is not evenly distributed.** The commerce spine — home, shop, PDP, cart, checkout, login, signup, profile — is fully designed. What is undesigned is everything *after* the purchase (confirmation, tracking), everything *around* it (appointments, search, branch locator, category), and the policy pages.

Appointments is the sharpest instance: a contracted, fully-implemented feature with slot validation and SMS notifications, shipped with no design at all.
