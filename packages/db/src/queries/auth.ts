import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '../database.types'

/**
 * Returns true if the currently authenticated user carries the super_admin
 * role claim in their JWT user_metadata. This is the source of truth for the
 * admin app's auth gate; the same claim drives the `is_super_admin()` SQL
 * helper in the migrations, so DB-level RLS and app-level routing stay in
 * sync.
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false
  const role = (user.user_metadata as Record<string, unknown> | null)?.role
  return role === 'super_admin'
}

export async function getSessionUser(
  db: SupabaseClient<Database>,
): Promise<User | null> {
  const { data } = await db.auth.getUser()
  return data.user
}
