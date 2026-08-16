/**
 * The 7 staff roles (CR-01 R1, migration 0025_rbac_foundation.sql).
 *
 * A small hardcoded list here is fine — `middleware.ts` and `login/page.tsx`
 * only use it to gate "is this a known staff role" (keep unrecognized
 * `app_metadata.role` values out), not "what can they do," which stays
 * entirely data-driven via `role_permissions` and `GET /auth/me`'s
 * server-computed `permissions` array. Adding an 8th role still requires a
 * one-line change here for login/middleware to recognize it, but every
 * permission decision downstream of that is a data change.
 */
export const STAFF_ROLES = [
  'super_admin',
  'branch_manager',
  'branch_staff',
  'inventory_manager',
  'accountant',
  'marketing',
  'doctor',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}
