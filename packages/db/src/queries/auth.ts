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
