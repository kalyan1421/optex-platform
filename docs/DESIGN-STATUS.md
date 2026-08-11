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
| nav bar | `0:3614` | 1480×640 |
| Top bar strip | `0:3763` | 1440×51 |
| Logo | `0:3791` | 112×93 |
| Colour + type swatches | `0:154`, `0:169`, `0:186` | `2E3192`, `1A1A1A`, `6C7AE0`, `8A8A8A`, `E0E0E0` |

**Coverage: 11 of 23 built storefront routes have a design.**

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

## 5. Open decisions

**1. Which home page is canonical?** `v1`, `v2` and `v3` are all 1440×8079 with **identical** section lists — hero, Categories, TrendingProductsSection, ProductsSection, FaceShapeSection, WhyChooseUsSection, PromotionsSection, TestimonialsSection, CTASection, Footer, nav bar. Nothing marks one as current. Until one is chosen and the others archived, the built homepage will drift from whichever was intended.

**2. The Shop filter set is narrower in design than in the schema.** The Shop screen specifies only **Categories** and **Brands**. But `products.frame_shape`, `products.gender` and `products.frame_material` all exist and are unused, and [FEATURE-STATUS §1](FEATURE-STATUS.md) lists price/shape/gender/material filters as Phase 1A gaps described as "UI work only". That framing is optimistic — there is nothing to build against. Either the filters get designed, or the columns get dropped from scope.

**3. Frame naming.** Three unrelated screens are all called `Complete Landing Page Sections`, and the real screen is two levels down. Renaming to `Shop`, `Product Detail` and `Contact` costs minutes and removes a recurring source of confusion.

---

## Summary

| | Count |
| --- | --- |
| Built storefront routes | 23 |
| **Routes with a design** | **11** |
| **Routes pending design** | **12** |
| Features needing design before build | 10 |
| Design-origin defects fixed in code but still live in Figma | 5 |

**The gap is not evenly distributed.** The commerce spine — home, shop, PDP, cart, checkout, login, signup, profile — is fully designed. What is undesigned is everything *after* the purchase (confirmation, tracking), everything *around* it (appointments, search, branch locator, category), and the policy pages.

Appointments is the sharpest instance: a contracted, fully-implemented feature with slot validation and SMS notifications, shipped with no design at all.
