import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../database.types';

/**
 * Returns true if the user carries the super_admin role claim in app_metadata.
 * app_metadata is only writable via the service-role Admin API — it cannot be
 * forged by the user. Migration 0007 moved the role from user_metadata (user-
 * writable) to app_metadata; this function must read app_metadata to stay in
 * sync with the is_super_admin() SQL helper.
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  // C-2 FIX: read app_metadata (set by Admin API only), not user_metadata
  const meta = (user as User & { app_metadata?: Record<string, unknown> }).app_metadata;
  return meta?.role === 'super_admin';
}

export async function getSessionUser(db: SupabaseClient<Database>): Promise<User | null> {
  const { data } = await db.auth.getUser();
  return data.user;
}

/**
 * Resolve a Supabase Auth user id to its `customers.id`.
 *
 * These are two different identifiers and must not be used interchangeably:
 * `carts`, `orders`, `appointments` and `prescriptions` all reference
 * `customers(id)`, while `auth.users(id)` is what a session carries. Passing an
 * auth id straight into `customer_id` fails the foreign key (and the RLS
 * `customer_id = current_customer_id()` check) — it is the SQL-side equivalent
 * of `current_customer_id()`.
 *
 * Returns null when no customers row exists yet. The `on_auth_user_created`
 * trigger (migration 0004) creates one for every new signup, so a null here
 * means either a pre-trigger account or a user that was deleted.
 */
export async function getCustomerIdForUser(
  db: SupabaseClient<Database>,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('customers')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}
