import { getTestDb } from './lib/test-db';

/**
 * Deletes every throwaway `@optex-test.local` auth user created across this
 * suite. Accounts are created via the real `/signup` form
 * (`checkout-authenticated.spec.ts`, `cart-merge.spec.ts`), which never
 * exposes the resulting auth user id back to the test — so cleanup happens
 * once here rather than per-spec.
 *
 * `listUsers()` paginates at 50 per page by default and does not filter by
 * email — has to be walked to completion, or only the first page's worth
 * ever gets deleted and the rest accumulate silently across runs.
 *
 * `checkout-authenticated.spec.ts`'s third test drives a real `POST
 * /checkout`, which commits a real `orders` row via `place_order`.
 * `orders.customer_id` has no `ON DELETE CASCADE` (unlike
 * `customers.auth_user_id`, which does) — an order left behind would make
 * the auth-user delete 409 on the cascade to `customers`, so any orders for
 * a stale customer must be deleted first.
 */
export default async function globalTeardown(): Promise<void> {
  const db = getTestDb();

  let page = 1;
  const staleIds: string[] = [];
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users;
    staleIds.push(...users.filter((u) => u.email?.endsWith('@optex-test.local')).map((u) => u.id));
    if (users.length < 200) break;
    page += 1;
  }

  if (staleIds.length) {
    const { data: staleCustomers } = await db
      .from('customers')
      .select('id')
      .in('auth_user_id', staleIds);
    const customerIds = (staleCustomers ?? []).map((c) => c.id);
    if (customerIds.length) {
      await db.from('orders').delete().in('customer_id', customerIds);
    }
  }

  for (const id of staleIds) {
    await db.auth.admin.deleteUser(id);
  }
}
