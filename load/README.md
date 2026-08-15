# Load tests

Closes audit finding **F-07**: the repo had no k6, Artillery, autocannon or
Gatling anywhere, no performance tier in `docs/TEST-PLAN.md`, and no capacity
target in the SOW. Functional coverage was good — 163 automated tests — but
every one of them exercises correctness at **concurrency one**, which is why
F-01, F-02 and F-05 all survived a green suite.

## Running them

k6 is a single static binary and is not a repo dependency:

```bash
brew install k6
```

Bring the stack up first, then point k6 at it:

```bash
docker compose up -d supabase-kong && docker compose run --rm supabase-migrate
docker compose up -d --build api
pnpm dev:web    # the browse/checkout scenarios go THROUGH the storefront proxy
```

```bash
k6 run load/browse.js
```

## Why the scenarios target the storefront, not the API

`BASE_URL` defaults to `http://localhost:1112` — the **Next.js** server, not
the API on `:1111`. That is deliberate and is itself part of the finding.

Browser traffic never reaches the API directly: it goes through the `/api/*`
rewrite in `apps/web/next.config.js`, so the storefront's Node process sits in
the path of every cart, checkout and payment call. Load-testing the API alone
would produce numbers that describe a path no customer takes and would miss the
proxy as a bottleneck entirely.

Override for a direct comparison — the gap between the two is the proxy's cost:

```bash
k6 run -e BASE_URL=http://localhost:1111 load/browse.js
```

## The scenarios

| File | What it puts under pressure |
|---|---|
| `browse.js` | Catalogue reads at expected peak — home, shop, PDP, search. The traffic 95% of visitors generate, and the path most affected by F-01's rate limiting. |
| `checkout-contention.js` | N shoppers racing for the last units of ONE product. Directly exercises the F-02 stock lock and the `place_order` transaction under contention. |
| `auth-ramp.js` | A ramp to find the 429 knee, and to prove the credential ceiling holds while normal browsing does not trip it. |
| `webhook-flood.js` | The unauthenticated, `@SkipThrottle` payment receivers — the only endpoints deliberately exempt from rate limiting, and therefore the ones worth knowing the limits of. |

## Thresholds

Each scenario fails the run on its own thresholds rather than printing numbers
for a human to interpret, so these are usable as a CI gate later. The values are
starting points chosen against the local stack — **re-baseline them against
staging hardware before treating a failure as a regression.**
