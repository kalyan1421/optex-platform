# @optex/api-client

Typed TypeScript client for the OPTEX NestJS API (`apps/api`). Consumed by `apps/web` and `apps/admin`, and serves as the source-of-truth contract for every endpoint. No runtime dependencies — uses the global `fetch`.

## Install

It's a workspace package; add it to an app's dependencies:

```jsonc
// apps/web/package.json
"dependencies": { "@optex/api-client": "workspace:*" }
```

## Usage

`createApiClient` takes a base URL and a `getAccessToken` callback (sync or async) used to attach `Authorization: Bearer <token>` to every request.

### Next.js — client component

```ts
import { createApiClient } from '@optex/api-client';
import { createBrowserClient } from '@optex/db/browser';

const supabase = createBrowserClient();

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

await api.cart.addItem({ productId, quantity: 1 });
```

### Next.js — server component / route handler

```ts
import { createApiClient } from '@optex/api-client';
import { createServerClient } from '@optex/db/server';

export async function getApi() {
  const supabase = createServerClient();
  const { data } = await supabase.auth.getSession();
  return createApiClient({
    baseUrl: process.env.API_URL!,
    getAccessToken: () => data.session?.access_token ?? null,
  });
}
```

## Errors

Non-2xx responses throw an `ApiError` carrying the API's error envelope:

```ts
import { ApiError } from '@optex/api-client';

try {
  await api.checkout.checkout(input);
} catch (e) {
  if (e instanceof ApiError) {
    console.error(e.status, e.code, e.message, e.requestId);
  }
}
```

## Surface

Method groups: `catalog`, `cart`, `orders` (incl. `checkout`, `tracking`), `payments`, `appointments`, `prescriptions`, `reviews`, `promotions`, `branches`, `account`, `contact`, and `admin` (orders / payments / products / promos / banners / branches / reviews / appointments / prescriptions / dashboard / analytics). Each maps to a route under the API's `/api` prefix. See `src/client.ts` for the full typed interface and `src/types.ts` for request/response shapes.
