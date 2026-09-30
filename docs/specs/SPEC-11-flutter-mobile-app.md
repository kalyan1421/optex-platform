# SPEC-11 — OPTEX Mobile App (Flutter, iOS + Android)

**Date:** 2026-09-22 (rev. 2) · **Status:** Draft for client sign-off · **Type:** PRD
**Contract position:** SOW-2025-001-KE v3.0 Phase 2 (Android). **iOS and Google Sign-In are scope additions** — see [Contract deltas](#10-contract-deltas).
**Delivery posture:** Build starts **now, in parallel** with CR-01 R3–R5. See [§9 API contract discipline](#9-api-contract-discipline--the-parallel-build-tax).
**Source:** [docs/PLAN.md §4](../PLAN.md) · [docs/AUDIT.md](../AUDIT.md) · live API surface as of `0041_homepage_curation.sql`

> **Build status (2026-09-23).** `apps/mobile` exists and all six feature slices are implemented against the live API. Firebase project `optex-opticians` is wired for push and Remote Config. Google Sign-In remains blocked — see [Q2](#open-questions).
>
> **Decisions locked (2026-09-22).** Customer app only · parallel start · Try-On as a late phase · **Firebase (FCM) for push on both platforms** · **English only, no Swahili in v1** · **minSdk 24** · **server-driven soft/hard upgrade gate** · **Google Sign-In on web _and_ mobile.**

## 1. Problem Statement

Optex Opticians sells eyewear in a market where **mobile is the internet**. Kenyan e-commerce runs on Android handsets and M-Pesa, and the single most common purchase path — see a frame, pay by phone, collect at a branch — is a phone-shaped journey that we currently serve through a mobile browser.

The storefront at `apps/web` works on mobile, but a browser cannot do the four things that decide whether an optician's customer comes back: **push a reminder** for an eye test or a ready-to-collect order, **use the camera** to capture a paper prescription, **work on a weak connection** in a matatu or a rural branch queue, and **sit on the home screen** as a re-entry point. Every one of those is a retention mechanism, and we have none of them.

The cost of not building it is concrete and already visible in the codebase. The prescription pipeline — upload, list, signed-URL download, admin review queue — is **built, e2e-tested, and has no user interface anywhere in the product** (`apps/api/src/modules/prescriptions/`, `apps/api/test/prescriptions.e2e-spec.ts`). We built a feature the web is the wrong medium for. A phone camera is the right one. Meanwhile appointment reminders go out as SMS at Africa's Talking per-message cost, when a push notification is free and richer.

The API was designed for this from the start: `apps/api` is a standalone NestJS service that already owns every write, speaks bearer tokens, and exposes `POST /auth/refresh` — **an endpoint that exists today and that nothing in the codebase calls.** It is waiting for a mobile client.

---

## 2. Goals

| #      | Goal                                                                                                                                          | Measured by                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **G1** | **A customer can complete a full purchase on the phone** — browse, configure, pay by M-Pesa, track to collection — without opening a browser. | ≥ 35% of all online orders placed in-app within 90 days of GA                                  |
| **G2** | **Prescriptions get captured where the paper actually is.** Give the dormant prescription API its first client, using the camera.             | ≥ 200 prescriptions uploaded in the first 90 days (baseline today: 0, no UI exists)            |
| **G3** | **Replace paid SMS reminders with free push** for appointment and order events, without losing delivery reliability.                          | ≥ 60% of reminders delivered by push rather than SMS; Africa's Talking spend down ≥ 40%        |
| **G4** | **Re-engagement Optex has never had.** Turn one-time buyers into returning ones via the home screen and notification surface.                 | 30-day app retention ≥ 25%; repeat-purchase rate of app users ≥ 1.4× web-only users            |
| **G5** | **The app works on a bad connection.** Catalog browsing stays usable offline or on 2G.                                                        | Product list renders from cache in < 1s with the network disabled; crash-free sessions ≥ 99.5% |

**Explicitly not a goal:** feature-for-feature parity with the storefront. The web keeps SEO, long-form content pages, and the compare grid. The app wins on camera, push, and speed.

---

## 3. Non-Goals

| Not doing                                                              | Why                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Staff / admin companion app**                                        | Client decision 2026-09-22: customer app only. Staff keep the web panel, which is already responsive and where RBAC, MFA step-up, and the audit log live. Shipping privileged code to consumer devices also widens the attack surface for no revenue. |
| **Guest checkout in-app**                                              | The API has no guest cart — `CartController` and `OrdersController` both sit behind the global auth guard with no `@Public()`. Changing that is a backend product decision affecting web too, not a mobile one. See [Q4](#open-questions).            |
| **Lens & coating configurator (v1)**                                   | [SPEC-07](SPEC-07-lens-configurator.md) is still blocked on the client price list and has no tables in migrations `0001`–`0041`. The app cannot ship a configurator the server cannot price. It is designed for in M3 and lit up when SPEC-07 lands.  |
| **Compare-frames grid**                                                | Exists on web (`/compare`) as pure client-side state with no API behind it. Low value on a 6-inch screen; revisit if analytics show demand.                                                                                                           |
| **Content pages** (about, terms, privacy, returns, warranty, delivery) | SEO assets that belong on the web. The app links out to them in a webview rather than duplicating six maintenance surfaces.                                                                                                                           |
| **Tablet / foldable-optimised layouts**                                | Kenyan eyewear buying is phone-first. Layouts stay responsive and will not break, but no dedicated tablet design work in v1.                                                                                                                          |
| **Offline _writes_** (queued orders, offline cart mutations)           | Sync conflict resolution against a stock-enforcing `place_order` RPC is a large correctness problem for a rare case. Offline is read-only in v1.                                                                                                      |
| **In-app chat / live support**                                         | No support tooling exists server-side. Contact form + phone deep-link covers v1.                                                                                                                                                                      |

---

## 4. User Stories

### Shopper

1. As a customer browsing on my phone, I want to **see frames on a fast, native list** so that a weak connection does not make me give up mid-browse.
2. As a customer, I want to **search and filter by shape, brand and price** so that I find frames that suit my face without scrolling a whole catalog.
3. As a customer, I want to **save frames to a wishlist** so that I can decide later or show someone.
4. As a customer, I want to **read verified-purchase reviews with a star rating** so that I trust a frame I cannot hold.
5. As a returning customer, I want the app to **remember me without logging in again** so that buying takes seconds.

### Buyer

6. As a customer, I want to **pay with M-Pesa by entering my phone number and approving the STK prompt** so that I never leave the app or retype a till number.
7. As a customer without M-Pesa, I want **card payment via Pesapal**, so that payment method is never the reason I abandon.
8. As a customer, I want to **apply a promo code and see the total change** before I commit.
9. As a customer, I want to **track my order to collection or delivery** so that I know when to go to the branch.
10. As a customer who changed their mind, I want to **request a cancellation** and see its status, rather than phoning the branch.

### Patient

11. As a customer with a paper prescription, I want to **photograph it with my phone** so that Optex can make my lenses without me driving to a branch. _(First client of an API that has none.)_
12. As a customer, I want to **see my uploaded prescriptions and their review status** so that I know Optex has what it needs.
13. As a customer needing an eye test, I want to **book a slot at a branch, pick a time, and get a reminder** so that I actually attend.
14. As a customer whose plans changed, I want to **reschedule or cancel my appointment in the app** so that I do not waste a clinician's slot.
15. As a new patient, I want to **fill the eye-care intake form** (demographics, health history, self-reported Rx) before I arrive, so my visit is shorter.

### Edge cases and failure states

16. As a customer whose STK push timed out, I want a **clear "we're still waiting / retry / choose another method"** state rather than a spinner that never ends or a double charge.
17. As a customer on a dead connection, I want to **still see what I browsed before** and a plain message about what needs network.
18. As a customer whose token expired mid-session, I want the app to **refresh silently** and never dump me on a login screen with a lost cart.
19. As a customer who denied camera or notification permission, I want the app to **keep working** and offer the permission again in context, not at cold start.
20. As a first-time visitor, I want to **browse the full catalog before being asked to create an account** — the wall goes up at add-to-cart, not at launch.

---

## 5. Requirements

### 5.1 Must-Have (P0) — v1.0 cannot ship without these

#### P0-1 · Authentication, Google Sign-In, and session

Bearer-token auth against `POST /auth/login`, `/signup` and `/forgot-password`, with silent renewal through `POST /auth/refresh` — **the first consumer this endpoint will ever have.** Tokens in platform secure storage (Keychain / EncryptedSharedPreferences), never `SharedPreferences` plaintext.

`POST /auth/reset-password` is **deliberately absent from this list.** The reset email's link is built server-side from `WEB_APP_URL` and cannot be redirected to the app, so the reset itself completes in a browser. The app requests the email and says so plainly rather than implying a flow it cannot finish — see B-6 in [§8](#8-backend-work-this-app-forces).

##### Google Sign-In — one identity provider, not two

Google Sign-In ships on **both the mobile app and the storefront**, via **Supabase Auth's native Google provider**.

> **Why not Firebase Auth.** OPTEX authentication is Supabase Auth end to end. `SupabaseAuthGuard` verifies every request with `supabase.auth.getUser(token)`, and everything downstream keys off that JWT: `current_customer_id()` and `is_super_admin()` in RLS, `app_metadata.role` / `branch_id` for the 7-role RBAC matrix, and `PermissionsGuard`'s `aal2` step-up. **A Firebase ID token fails `getUser()`**, so adopting Firebase Auth means either a custom token-exchange endpoint maintaining two user records per person with account-linking edge cases, or migrating auth wholesale — which would break RLS, the RBAC matrix, admin MFA, and all 25 API e2e specs.
>
> Supabase's native Google provider delivers the identical user-facing outcome — a Google button on web and a native Google sheet on mobile — with **one** user record, **one** JWT issuer, and **zero** changes to the guard, RLS, or RBAC. Firebase stays in the stack for FCM push, which is the job it is right for. If there is a requirement behind "from Firebase" that this does not meet, say so and we will spec the token-exchange path instead.

**Mobile:** `google_sign_in` plugin → Google ID token → `supabase.auth.signInWithIdToken({ provider: 'google' })`. Native account sheet, no webview.
**Web (`apps/web`):** `signInWithOAuth({ provider: 'google' })` redirect flow, added to the existing `/login` and `/signup` pages.

**No new backend endpoint is required.** `0004_customers_trigger.sql` fires `after insert on auth.users` for _any_ provider, so a first-time Google user gets their `customers` row automatically — the same path email/password signup already takes.

##### Sign in with Apple — mandatory on iOS, caused by Google

App Store Review **Guideline 4.8** exempts apps that _exclusively_ use their own account system. Adding Google breaks that exemption, so **offering Google Sign-In makes Sign in with Apple a hard requirement for the iOS build.** It is a standard, well-documented rejection cause. Supabase Auth supports Apple natively, so this is provider configuration and a second button — not a second architecture — but it must be in scope from M0 rather than discovered at submission.

##### Staff must never authenticate this way

Google and Apple sign-in are **customer-only**, on the storefront and the app. They are never added to `apps/admin`. This is safe by construction — a social-signup user has no `app_metadata.role`, so `PermissionsGuard` denies every admin route — but it must stay an explicit rule: staff roles are server-set through the Admin API, and the admin panel keeps email/password plus TOTP `aal2` step-up.

##### Acceptance criteria

- [ ] Given a valid session, when the access token expires mid-request, then the client refreshes and replays the original request with no visible interruption
- [ ] Given a refresh token that is revoked or expired, when refresh fails, then the user lands on login with cart and wishlist state preserved for post-login merge
- [ ] Given the device is rooted/jailbroken or storage is unavailable, when token write fails, then the session degrades to in-memory rather than falling back to plaintext
- [ ] Given a user signs out, then the client calls `POST /auth/logout` **and** clears local secure storage — either failing alone must not leave a usable token on device
- [ ] Concurrent 401s from parallel requests trigger exactly one refresh, not N
- [ ] Given a first-time Google user, when they sign in, then a `customers` row is created by the `0004` trigger **with their name populated** — verify Supabase's Google provider writes `full_name` into `raw_user_meta_data`, since the trigger reads that exact key and a mismatch silently yields a nameless customer
- [ ] Given an existing email/password account, when the same person signs in with Google on the same address, then they reach **one** account, not a duplicate — identity-linking behaviour is decided and tested, not left to defaults ([Q5](#open-questions))
- [ ] Given a user cancels the Google or Apple sheet, then they return to the login screen with no error state and no partial account
- [ ] Given Sign in with Apple with "Hide My Email", then the relay address is stored and order confirmation email to it is verified end to end
- [ ] Google Sign-In produces an identical session shape on web and mobile — the same `/auth/me` response, the same `customers` row
- [ ] No social provider is reachable from `apps/admin`, asserted by a test

#### P0-2 · Catalog browse and search

`GET /products`, `/products/search`, `/products/:slug`, `/products/:id/related`, `/categories`, `/categories/:slug`, `/banners`. Honours the homepage curation added in `0041_homepage_curation.sql` (featured / trending).

- [ ] Product list paginates and preserves scroll position across navigation
- [ ] Filters (category, price, brand, shape) and sort round-trip to the API, not client-side over a partial page
- [ ] PDP shows images, price via `formatKes`, stock state, `rating_avg`/`rating_count` stars, and related products
- [ ] A product with zero stock across all branches is visibly unavailable and cannot be added to cart
- [ ] Search returns within 800ms p75 on 3G, with a debounced input and an explicit empty state

#### P0-3 · Cart and promotions

`GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `POST /cart/apply-promo`, `DELETE /cart/promo`.

- [ ] Cart totals are always the server's computed values, never recalculated client-side
- [ ] Quantity respects the bounds enforced by `0034_cart_qty_bounds.sql`; exceeding them shows the server's message
- [ ] An invalid or expired promo code shows the API's reason, and the cart total reverts cleanly
- [ ] Add-to-cart while signed out routes to sign-in, then completes the original add — the intent is not lost

#### P0-4 · Checkout and payments

`POST /checkout` then one of: **M-Pesa** (`POST /payments/mpesa/stk-push`, poll `POST /payments/mpesa/query`) or **Pesapal** (`POST /payments/pesapal/initiate` → webview → `GET /payments/pesapal/status`).

> **Correction (rev. 3).** Earlier revisions listed **cash on delivery** as a third method. That was wrong. The client withdrew COD in [CLIENT-ANSWERS E6](../CLIENT-ANSWERS.md) — _"Remove from checkout **and** reject at the API"_ — and `orders.service.ts:156-167` enforces it with a documented backstop, because `place_order` still accepts `'cod'` at the database level for historical rows. Building the option would have produced a fully-filled checkout that fails at the final step. The app still renders `cod` correctly on historical orders.

> **Note on the SOW's "in-app M-Pesa SDK":** Safaricom publishes no consumer-facing mobile SDK. Daraja STK Push — what the API already implements — _is_ the in-app experience: the customer types their number, approves a system prompt from Safaricom, and never leaves the app. No change of approach, just a naming correction.

- [ ] Given an STK push is initiated, the app polls `mpesa/query` with backoff and surfaces pending / success / failed / timeout as four distinct states
- [ ] Given a push times out, the customer can retry or switch method **without creating a second order**
- [ ] Given the app is backgrounded during payment, on resume it re-queries status rather than assuming failure
- [ ] Pesapal opens in an in-app webview (ASWebAuthenticationSession / Custom Tabs), returns via deep link, and status is confirmed **server-side** — never trusted from the redirect URL
- [ ] Stock rejection from `place_order` (per `0020_checkout_stock_enforcement.sql`) renders as a specific, actionable message naming the offending line
- [ ] No payment screen can be re-entered by back-navigation after success

#### P0-5 · Orders and tracking

`GET /orders`, `/orders/:id`, `/orders/:id/tracking`, `GET`/`POST /orders/:id/cancellation`.

- [ ] Order list shows status, total, date, and item thumbnails, newest first
- [ ] Tracking renders the status timeline from the API — no client-side status inference
- [ ] A customer can submit one cancellation request per order and see pending / approved / declined
- [ ] Deep link `optex://orders/{id}` opens the correct order for an authenticated user, and routes to login-then-target otherwise

#### P0-6 · Account and addresses

`GET`/`PATCH /me`, full CRUD on `/addresses` plus `POST /addresses/:id/default`.

- [ ] Profile edit, address CRUD, and default-address selection all persist server-side
- [ ] Deleting the default address forces selection of a replacement before checkout proceeds

#### P0-7 · Branch locator

`GET /branches`, `GET /branches/:id`.

- [ ] Branch list with name, address, hours, phone; tapping phone dials, tapping address opens the platform map app
- [ ] Sorted by distance when location permission is granted, alphabetically when denied — denial is never a blocker

#### P0-8 · Prescription capture _(the flagship)_

`POST /prescriptions/upload`, `GET /prescriptions`, `GET /prescriptions/:id/download`.

- [ ] Customer can capture with the camera or pick from the gallery, with edge detection and a retake step before upload
- [ ] Image is compressed client-side to a sane ceiling before upload; upload shows real progress and survives backgrounding
- [ ] Uploaded prescriptions list with pending / processed status from the review queue
- [ ] Viewing a prescription fetches a fresh 60s signed URL each time and never caches the file to shared storage
- [ ] Camera permission denial falls back to gallery picker; both denied shows an explanatory state, not a dead end

#### P0-9 · Appointments

`GET /appointments/slots`, `POST /appointments`, `GET /appointments`, `PATCH /appointments/:id/cancel`, `PATCH /appointments/:id/reschedule`.

- [ ] Branch → service → date → slot → confirm, mirroring the storefront's wizard
- [ ] Slot availability respects configurable capacity (`0018`) and refreshes before submit to avoid booking a slot taken in the interim
- [ ] Reschedule and cancel are available up to the business cut-off; past that the UI explains why not
- [ ] Booked appointments appear in the app and can be added to the device calendar

#### P0-10 · Push notifications _(net-new backend work — see §8)_

**Transport: Firebase Cloud Messaging for both platforms** (client decision 2026-09-22). FCM relays to APNs for iOS, so there is one SDK, one token model, and one sender integration rather than two. The cost is a Google dependency in an otherwise Supabase/Render stack — accepted deliberately, and contained: FCM is a delivery channel beside `sms.service.ts` and `email.service.ts`, not an identity or data store. An APNs certificate/key is still required and is created under the same Apple account as [Q1](#open-questions).

- [ ] Device token registers on login and on rotation, and de-registers on logout
- [ ] Order, appointment and offer events deliver as push, matching the three existing `NOTIFICATION_CATEGORIES`
- [ ] Tapping a notification deep-links to the specific order/appointment, cold start included
- [ ] Per-category opt-out in settings, honoured server-side
- [ ] **Push failure falls back to the existing SMS path** — a customer who denied permission or has no network still gets their reminder. Push is an optimisation over `notification_log`, not a replacement for it.

#### P0-11 · In-app notification centre

`GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`.

- [ ] Badge count from `unread-count`, refreshed on foreground
- [ ] Category filter (order / appointment / offer), mark-one-read, mark-all-read
- [ ] Tapping an item deep-links to its subject

#### P0-12 · Offline read cache

- [ ] Last-viewed catalog pages, PDPs, and the user's orders render from local store (Drift/Isar) with the network disabled
- [ ] A persistent, non-blocking offline banner appears; actions needing network are disabled with a reason, not silently failing
- [ ] Cache invalidates on reconnect and honours a max-age so stale prices are never shown at checkout

#### P0-13 · Release engineering

**Android minSdk 24 (Android 7.0); iOS 14+.** The "Kenyan devices may argue for lower" concern does not survive contact with the data. StatCounter's Kenya figures for August 2026 put **Android 11 and newer at 83.8% of mobile+tablet traffic**, with Android 13 the single largest version at 17.4% and Android 13–16 together at 61.2%. Kenya is not a legacy-Android market in 2026. minSdk 24 therefore sits comfortably _below_ the real distribution — it is already the conservative choice, and dropping further would buy a sliver of users at the cost of Flutter plugin support, modern TLS defaults, and notification-channel back-compat for the push work in P0-10.

- [ ] Android (minSdk 24) and iOS (14+) build from one codebase in CI
- [ ] Dev / staging / production flavours with separate bundle IDs and API base URLs
- [ ] Crash and performance reporting (Sentry or Crashlytics) live from the first internal build
- [ ] Both store listings pass review: privacy manifests, data-safety form, permission purpose strings, Kenya DPA 2019 privacy policy link

#### P0-14 · Version gate and force-upgrade policy

A mobile release cannot be hot-fixed — it waits on store review, on devices that may never update. The gate that handles that must exist in v1.0, because **a policy added later cannot reach the versions already in the wild.**

**Mechanism: Firebase Remote Config**, not a new API endpoint. Firebase is already in the stack for FCM (P0-10), Remote Config is free, and it lets the minimum move in minutes without a backend deploy. It serves `{ minSupportedVersion, latestVersion, message, storeUrl }`.

**Policy (engineering's call, 2026-09-22):**

| State                | Behaviour                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current              | Nothing                                                                                                                                                           |
| **Update available** | Dismissible prompt, shown at most once per 72h. The default for every release.                                                                                    |
| **Unsupported**      | Non-dismissible screen with a store link. Reserved for three causes only: a security fix, a payment-correctness bug, or removal of an API the version depends on. |

- [ ] The minimum version is **never hardcoded in the binary** — a shipped constant is exactly the thing that cannot be changed when it matters
- [ ] A version gets ≥ 30 days of soft nudging before it is ever hard-blocked — except a security or payment-integrity issue, which may block immediately
- [ ] **The check fails open.** If Remote Config is unreachable or slow, the app proceeds normally. Blocking a paying customer because a config service is down is a worse outcome than serving an old client.
- [ ] Checked on cold start and on foreground after > 1h idle, never mid-checkout
- [ ] The app version header from §9 is sent on every API request from M0, so we can see the live version spread _before_ deciding to block anything

### 5.2 Nice-to-Have (P1) — fast follow, not launch blockers

| #    | Requirement                                                          | Note                                                                    |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P1-1 | **Wishlist** — `GET /wishlist`, `POST`/`DELETE /wishlist/:productId` | Cheap; likely pulled into P0 if M1 runs ahead                           |
| P1-2 | **Write a review** — `POST /products/:id/reviews`                    | Read is P0; write needs a purchase-verified prompt post-delivery        |
| P1-3 | **Eye-care intake form** — `POST /eye-records`                       | Long form; better as a pre-appointment prompt than a cold-start feature |
| P1-4 | **Biometric unlock** for returning sessions                          | Face ID / fingerprint over the stored refresh token                     |
| P1-5 | **Social / share** — share a frame via deep link with OG preview     | Growth lever, needs web-side link resolution                            |
| P1-6 | **In-app rating prompt** after a delivered order                     | Gate on ≥ 2 successful sessions, never on first launch                  |
| P1-7 | **Dark mode** using the `packages/config` CSS-variable token set     | Tokens exist; the work is auditing contrast                             |

### 5.3 Future Considerations (P2) — not built, but must not be designed out

| #    | Consideration                                                             | What we must not break now                                                                                                                                               |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2-1 | **Lens & coating configurator** ([SPEC-07](SPEC-07-lens-configurator.md)) | PDP and cart models must accommodate line-item options and server-computed option pricing. Do not hardcode "price = product.price".                                      |
| P2-2 | **Virtual Try-On** (Phase 3 — §7 M5)                                      | Keep camera and ML dependencies isolatable; `products.try_on_image_url` already exists and should flow through the product model from day one.                           |
| P2-3 | **Doctor consultation** (CR-01 R5)                                        | Appointment model should tolerate a `doctor_id` and a consultation type without a schema-shaped rewrite.                                                                 |
| P2-4 | **Staff companion app**                                                   | Keep the design system, API client, and auth layer in shared Flutter packages so a second target reuses them rather than forking.                                        |
| P2-5 | **Loyalty / store credit**                                                | Order totals UI should render an arbitrary list of server-supplied adjustment lines, not a fixed subtotal/shipping/tax triple.                                           |
| P2-6 | **Guest checkout**                                                        | Keep cart state in a local store that can be adopted by an account later, so enabling guest carts server-side is a backend change plus a merge call, not an app rewrite. |

---

## 6. Success Metrics

### Leading indicators — first 30 days post-GA

| Metric                                 | Success | Stretch | Method                                                   |
| -------------------------------------- | ------- | ------- | -------------------------------------------------------- |
| Installs                               | 1,500   | 3,000   | Play Console + App Store Connect                         |
| Activation (install → account created) | 45%     | 60%     | `auth/signup` attributed by client header                |
| Browse → add-to-cart                   | 12%     | 18%     | Analytics funnel                                         |
| Cart → completed order                 | 45%     | 60%     | Orders per cart created, in-app segment                  |
| M-Pesa STK success rate                | 85%     | 92%     | `mpesa_transactions` success ÷ initiated, app-attributed |
| Prescription uploads                   | 60      | 150     | `prescriptions` table count, app-sourced                 |
| Crash-free sessions                    | 99.5%   | 99.8%   | Sentry / Crashlytics                                     |
| Cold start (p75, mid-tier Android)     | < 2.5s  | < 1.8s  | Firebase Performance                                     |

### Lagging indicators — 90 days to 6 months

| Metric                                | Success | Method                                              |
| ------------------------------------- | ------- | --------------------------------------------------- |
| Share of online orders placed in-app  | ≥ 35%   | Order source attribution                            |
| 30-day retention                      | ≥ 25%   | Store console cohort                                |
| Repeat-purchase rate, app vs web-only | ≥ 1.4×  | Orders per customer by first-order channel          |
| Africa's Talking SMS spend            | ↓ ≥ 40% | `notification_log` channel split + provider invoice |
| Appointment no-show rate              | ↓ ≥ 15% | Appointments completed ÷ booked, pre/post           |
| Store rating                          | ≥ 4.3   | Play Console + App Store Connect                    |

**Instrumentation is a P0 dependency, not an afterthought.** Order-source attribution and a `notification_log` channel column must ship _before_ GA, or none of the lagging metrics above are measurable. Budget it into M2.

---

## 7. Phases

Five delivery phases, ~13 weeks to GA. Phase M5 (Try-On) is separately contracted.

### M0 · Foundation — 2 weeks · _no user-facing output_

Flutter workspace and CI; dev/staging/prod flavours; Riverpod + `go_router` architecture; typed API client generated from the API's Swagger at `/api/docs` (keeps `packages/api-client`'s contract as the single source of truth); secure token storage with the refresh interceptor; the design system ported from `packages/config`'s brand tokens (`brand.blue #2E3192`, `brand.red #E53935`, `brand.dark #1A1A2E`, Montserrat — the preset's value, which matches Figma; `CLAUDE.md` quoted a stale `#2A3182`); crash reporting; widget + golden test harness.

Auth lands here in full: email/password, **Google Sign-In**, and **Sign in with Apple** (P0-1), plus the Firebase project that both FCM (P0-10) and the Remote Config version gate (P0-14) depend on.

**Exit:** a user can sign in by email, by Google, and by Apple from both platforms in CI-built binaries, and reach `/auth/me`.
**Parallel client action:** open the Apple Developer and Google Play Console accounts — **the longest lead item in the project.** Note that Sign in with Apple makes the Apple account a hard dependency of M0, not just of the iOS build.

### W1 · Storefront Google Sign-In — ~1 week, parallel, web team

Not a Flutter phase. B-4 adds the Google button to `apps/web`'s `/login` and `/signup` using the same Supabase provider the app uses, so web and mobile share one identity from day one. Runs alongside M0–M1 and is independent of the app's schedule.

**Exit:** a customer can sign in with Google on the live storefront and see the same account in the app.
**Caution:** this modifies a shipped, revenue-carrying product. It needs its own regression pass over the existing email/password flow, not just a happy-path test of the new button.

### M1 · Browse and Account — 3 weeks

P0-2 catalog, P0-6 account/addresses, P0-7 branch locator, P1-1 wishlist. Strings externalised as a matter of course — English only ships, but no hardcoded literals, so adding a locale later is a translation file rather than a refactor.

**Exit:** internal testing track on both stores; a tester can browse the real catalog and manage their profile.

### M2 · Transact — 3 weeks · **first public submission**

P0-3 cart, P0-4 checkout and all three payment methods, P0-5 orders and tracking, plus the analytics instrumentation the metrics depend on.

**Exit:** a real customer completes a real M-Pesa purchase in a store-distributed beta. This is the phase that earns revenue; everything after it earns retention.

### M3 · Clinical — 2.5 weeks

P0-8 prescription camera capture, P0-9 appointments, P1-3 eye-care intake. PDP and cart models extended to accommodate SPEC-07's option pricing **whether or not SPEC-07 has landed** (P2-1).

**Exit:** prescription-to-appointment journey works end to end; the prescription API has a client for the first time.

### M4 · Engagement and Resilience — 2.5 weeks · **1.0 GA**

P0-10 push (with its backend work, §8), P0-11 notification centre, P0-12 offline cache, P0-13 store-readiness hardening, P1-2 reviews, P1-6 rating prompt.

**Exit:** public release on both stores. Warranty clock starts.

### M5 · Virtual Try-On — Phase 3, separately contracted

Not part of the 13 weeks. Google ML Kit face detection (per [AUDIT.md](../AUDIT.md) line 424), frame overlay from `products.try_on_image_url`, capture and share. **Hard-blocked on a non-engineering dependency:** transparent PNG cutouts for every frame SKU, which AUDIT.md flags as an open client action. No cutouts, no try-on — the code is the easy half.

---

## 8. Backend work this app forces

These are `apps/api` / `apps/web` tickets, not Flutter tickets, and must be scheduled against those teams.

| #       | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                                                                                | Needed by            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **B-1** | **Push infrastructure does not exist.** No FCM, APNs, device-token table, or sender service anywhere in the codebase. Needs: a `device_tokens` migration, register/deregister endpoints, an FCM sender beside the existing `sms.service.ts` / `email.service.ts`, and fan-out on the same events that already write `customer_notifications`. Reuse `notification_log` (`0023`) for delivery accounting and the SMS fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | grep for `fcm`, `apns`, `device_token`, `firebase` across `apps/api/src`, all 41 migrations and `packages/` — zero hits | **M4**               |
| **B-2** | **Order-source attribution does not exist.** Without it, "35% of orders placed in-app" is unmeasurable. Needs a `source` column on `orders` plus a client header the API records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | No such column through `0041`                                                                                           | **M2**               |
| **B-3** | **Enable Supabase Auth's Google and Apple providers.** Dashboard configuration, OAuth client IDs per platform (iOS / Android / Web), and redirect-URL allowlisting. Plus one verification: `0004_customers_trigger.sql` reads `raw_user_meta_data ->> 'full_name'`, so confirm the Google and Apple providers populate that exact key — a mismatch silently creates nameless customers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `0004_customers_trigger.sql`; zero social-login surface in the codebase today                                           | **M0**               |
| **B-4** | **Google Sign-In button on the storefront** (`apps/web` `/login` and `/signup`). Small, but it is a change to a **live, shipped** product and needs its own QA pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Client request 2026-09-22                                                                                               | **W1** (parallel)    |
| **B-7** | **Nothing bounds concurrent payment attempts on one order.** `payments.service.ts:135-144` documents that a second STK push "simply inserts a new pending row keyed by a new CheckoutRequestID"; Pesapal's `initiate` likewise opens a second session and overwrites `orders.pesapal_id`. Audit A-03 bounds the _spread_ of destination numbers and a throttle bounds the rate, but neither bounds **concurrency**. If a customer approves two prompts, Safaricom debits twice: `creditOrder` is idempotent so the order is credited once and the surplus sits matched-but-unapplied for admin reconcile — the money is real, the order is not. The client re-queries every prior attempt before a retry, which closes the common case but not the race between that check and a second PIN entry. **Needs a server-side guard:** refuse a new attempt while an unresolved one is under ~90s old, or return the existing `CheckoutRequestID`. | `payments.service.ts:135-144`, `:1005-1015`; found building the commerce slice                                          | **Before GA**        |
| **B-6** | **Password reset cannot complete in the app.** `auth-flow.service.ts`'s `resetRedirectUrl()` builds the link from the server-side `WEB_APP_URL` and deliberately refuses a client-supplied value — a correct open-redirect guard, but it means the emailed link always points at the web storefront. A mobile user finishes the reset in a browser and returns to sign in. Fixing it needs an API change (an allowlisted mobile redirect, or a deep-link bridge on the web reset page), not a client one.                                                                                                                                                                                                                                                                                                                                                                                                                                     | `auth-flow.service.ts:108-111`; found while building the account slice                                                  | M3 (not GA-blocking) |
| **B-5** | **SPEC-07 lens configurator** is blocked on the client price list and has no schema. The app ships without it and lights it up when it lands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No lens/coating tables in `0001`–`0041`                                                                                 | P2, not blocking     |

> **B-7 status (2026-09-30) — closed server-side.** Migration `0042_payment_attempt_guard.sql` adds `claim_payment_attempt` / `release_payment_attempt`, and `PaymentsService` now reserves the order **before** calling the provider (the pending row is only written after the provider answers, so a check-then-insert lets two simultaneous requests both pass). An order has at most one live attempt across both rails: a repeat request to the **same number** is answered with the live prompt's `CheckoutRequestID` instead of a second prompt; a different number, or the other rail, is a 409 whose message says where the live attempt is and when to retry. The window is 90s; a resolved attempt (`matched`/`failed`/`reversed`) stops blocking at once.
>
> Two behaviours worth knowing. **An unknown outcome keeps the order closed** — an STK push that timed out or returned a 5xx may already be on the handset, so the claim is left to expire rather than released (a plain refusal from Daraja releases it immediately). And the Daraja and Pesapal calls now carry explicit timeouts (10s auth, 25s submit): a request must never outlive its own claim, and `fetch` had none. The migration must reach the database **before or with** the API deploy; if it has not, payments proceed unguarded and log an error rather than going down. No client change was needed — the app's existing 409 handling surfaces the new message as-is.

> **B-2 status (2026-09-30) — closed.** Migration `0043_order_source.sql` adds `orders.source` (`web` | `ios` | `android`). The API reads `X-Optex-Client` and stamps the channel immediately after `place_order` commits; the app now sends `ios` or `android` (it previously sent the framework name `flutter`, which cannot tell the stores apart) from construction, independent of the version lookup. `web` means "not identified as a mobile app", so history needs no backfill. The API now also logs `client` and `clientVersion` on every request, which is what §9 control 2 ("the API logs it") assumed and was not yet true. Share of paid orders placed in-app: see the query in the migration header.

Four things that are **not** work, and are worth saying plainly:

- **`POST /auth/refresh` already exists** and is currently called by nothing ([API-MIGRATION-PLAN §4](../API-MIGRATION-PLAN.md)). The cookie-free session model that doc says would "justify revisiting" the auth residue is exactly what this app needs — and the endpoint is already built and tested.
- **The prescription API is complete and e2e-covered.** No backend work required; it simply needs a client.
- **Google Sign-In needs no new endpoint and no customer-provisioning work.** `0004`'s trigger fires on any `auth.users` insert regardless of provider, so social signups land in `customers` down the same path email/password already takes.
- **The version gate needs no endpoint either** — Firebase Remote Config (P0-14) serves it, reusing the Firebase project that FCM already requires.

---

## 9. API contract discipline — the parallel-build tax

The client chose to start mobile **now**, alongside CR-01 R3–R5. That buys ~8 weeks of calendar time and costs contract stability: the app will be built against an API that is still changing. Three controls make that safe, and they are not optional.

1. **Additive-only changes to customer-facing endpoints** for the duration of the build. R3 (product analysis), R4 (branch revenue) and R5 (doctor consultation) are admin-side by design, so this is cheap to honour — but it must be a stated rule with a reviewer enforcing it, not an assumption.
2. **The app declares a version header** on every request from M0. The API logs it. When a breaking change eventually becomes necessary, we can see exactly which client versions are in the wild before deciding whether to force an upgrade.
3. **`api-client-contract.e2e-spec.ts` is the contract gate.** The Flutter client is generated from the same Swagger definition that suite covers, so a breaking change fails CI on the web side before it reaches a shipped binary that cannot be hot-fixed.

**The asymmetry that makes this matter:** a broken web deploy is fixed in minutes. A broken mobile release waits days for App Store review, on devices that may never update.

---

## 10. Contract deltas

Four items in this PRD sit outside SOW-2025-001-KE v3.0 as written. Each needs explicit client sign-off before M0 starts.

| Delta                            | SOW position                                                                          | This PRD                                | Impact                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iOS**                          | Phase 2 is Android / Play Store only (Week 8: "Play Store submission")                | iOS + Android from one Flutter codebase | +$99/yr Apple Developer; App Store review adds days per release; ~15–20% extra QA. Marginal build cost is low _because_ Flutter was chosen — the cost is accounts, review, and device testing, not code.                                                                                              |
| **Parallel start**               | PLAN.md §4: "Out of scope until Phase 1B is live and warranty-stable"                 | Starts now, alongside R3–R5             | ~8 weeks earlier to market, in exchange for the contract discipline in §9                                                                                                                                                                                                                             |
| **Push infrastructure**          | Not itemised; "push notifications" listed as an app feature with no backend line item | B-1 is real backend work in `apps/api`  | Must be scheduled against the backend team, not absorbed by the Flutter budget                                                                                                                                                                                                                        |
| **Google Sign-In, web + mobile** | Not in the SOW at all. The storefront ships email/password only.                      | Google on both surfaces, Apple on iOS   | Three consequences: (1) **B-4 modifies a live product** and needs its own QA; (2) **Sign in with Apple becomes mandatory on iOS** under Guideline 4.8, which is scope the request implies but does not name; (3) the Apple Developer account moves from an iOS-build dependency to an **M0 blocker**. |

---

## Open Questions

Q5–Q8 of rev. 1 (push provider, Swahili, minSdk, force-upgrade) were **answered on 2026-09-22** and are now requirements in §5, not questions. What follows is what remains open.

**Blocking — must be answered before M0 starts**

| #      | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Owner                 |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Q1** | Do the Apple Developer ($99/yr) and Google Play Console ($25 one-time) accounts exist? [ROADMAP.md](../ROADMAP.md) says the Play account still does not. Both need a legal entity, a D-U-N-S number for an org-level Apple account, and can take **weeks**. **Google Sign-In escalated this:** Sign in with Apple now makes the Apple account an M0 blocker, not just an iOS-build one. This is the critical path, and it is paperwork, not code.                                                                                                                                                                                                                                                                                                                                                              | Client                |
| **Q2** | **Partly answered.** The Firebase / Google Cloud project `optex-opticians` (number `1040067238863`) exists and both apps are registered against the unified id **`ke.co.optex.mobile`**, so FCM push and the Remote Config version gate are configured. Two things remain, neither of them a Firebase action: **(a)** the Google Cloud **OAuth consent screen** is not set up, so `google-services.json` returns `oauth_client: []` and Google Sign-In cannot work; **(b)** because this app authenticates through **Supabase's** Google provider rather than Firebase Auth, the resulting Web client ID and secret must also be entered in the Supabase dashboard (Authentication → Providers → Google). Store-listing ownership (Optex vs Asan) is still open and still painful to change after publication. | Client                |
| **Q3** | Is there a Kenya DPA 2019-compliant privacy policy at a resolving URL? Both stores reject submissions without one, and **none of the custom domains in `docs/` currently resolve** — `optexopticians.co.ke` included. Google Sign-In raises the bar: the policy must now also disclose the data received from Google and Apple.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Client + Legal        |
| **Q4** | Does the account wall stay at add-to-cart? Requiring signup before a cart hurts mobile conversion more than web, but changing it means guest-cart support server-side, affecting web too. Recommendation: keep the wall for v1 — Google Sign-In makes account creation roughly a two-tap operation, which is most of the friction the wall was costing us. Measure drop-off, revisit with data.                                                                                                                                                                                                                                                                                                                                                                                                                | Product               |
| **Q5** | **Identity-linking behaviour.** A customer signs up with `x@gmail.com` and a password, then later taps "Continue with Google" on the same address. Do they reach one account or two? Supabase's behaviour depends on a project setting, and both choices have a real failure mode: automatic linking is the better experience but trusts the provider's email verification, while no linking silently strands a customer's order history behind a second account. Recommendation: **enable linking, restricted to verified emails.** Needs an explicit decision and an e2e test either way.                                                                                                                                                                                                                    | Engineering + Product |

**Non-blocking — resolve during build**

| #      | Question                                                                                                                                                                                                                                                                                                                                    | Owner            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Q6** | Should push _replace_ SMS for reminders or run alongside it? P0-10 specifies fallback-on-failure; full replacement would cut cost further but risks missed clinical reminders. Recommend measuring push delivery for 60 days before cutting SMS.                                                                                            | Product + Client |
| **Q7** | App-store screenshots and marketing assets — in the Flutter scope or the client's design budget?                                                                                                                                                                                                                                            | Client           |
| **Q8** | Does the storefront keep email/password signup once Google is live, or lead with Google? Keeping both is assumed; leading with Google is a conversion question worth testing. Note that removing email/password entirely would _restore_ the Guideline 4.8 exemption only if Google were also removed — so email/password stays regardless. | Product          |

---

## Timeline Considerations

**Critical path is account provisioning, not engineering.** Q1 gates M0 now that Sign in with Apple is in scope. Start it on day one; it is the only task here that cannot be compressed by adding engineers.

**Dependencies out of the Flutter team's control:**

| Dependency                                    | Blocks                                          | Owner                                        |
| --------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| Apple Developer account (Q1)                  | **M0** — Sign in with Apple, then the iOS build | Client                                       |
| Google Play Console (Q1)                      | M1 exit onward                                  | Client                                       |
| Firebase project + OAuth client IDs (Q2)      | M0 (auth, Remote Config), M4 (FCM)              | Client + Engineering                         |
| Supabase Google/Apple providers enabled (B-3) | M0                                              | `apps/api` team                              |
| Privacy policy on a resolving domain (Q3)     | M4 GA                                           | Client + Legal                               |
| Push backend B-1                              | M4                                              | `apps/api` team                              |
| Order-source attribution B-2                  | M2 (metrics, not features)                      | `apps/api` team                              |
| Frame PNG cutouts                             | M5 entirely                                     | Client — AUDIT.md already flags this as open |
| Lens price list (SPEC-07)                     | P2-1 only                                       | Client                                       |

**Net schedule effect of the rev. 2 decisions:** roughly neutral on the 13-week estimate. Dropping Swahili and settling minSdk/force-upgrade removes work and indecision; Google and Apple sign-in add perhaps 4–5 days across M0 and W1, most of it configuration and QA rather than code, because Supabase provides both providers natively. **The schedule risk is not the engineering — it is Q1.** If the Apple account takes three weeks to provision, M0 cannot exit, and no amount of Flutter work routes around that.

**Compression options if the date moves in:** M3 (clinical) and M4 (engagement) can swap order — push and offline are more valuable to a shopper than prescription upload is on day one, though prescription capture is the strategic differentiator. M1's wishlist and M4's reviews are the only genuinely droppable items; everything else in P0 is load-bearing.

**Do not compress by starting before M0's foundation is done.** Auth, the refresh interceptor, and the generated API client are the layer every later phase sits on, and retrofitting secure token handling into a shipped app is how credentials end up in plaintext.
