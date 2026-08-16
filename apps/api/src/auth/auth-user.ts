/**
 * Authenticated principal attached to `request.user` by `SupabaseAuthGuard`.
 */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  /**
   * `app_metadata.branch_id` for branch-scoped staff (Branch Manager, Branch
   * Staff). Undefined for roles that aren't branch-scoped, and for any staff
   * account created before the `StaffModule` (R1 1c) starts writing it.
   */
  branchId?: string;
  /**
   * Authenticator Assurance Level from the JWT's `aal` claim — `'aal2'` means
   * the session has completed an MFA challenge. Used by `PermissionsGuard`
   * (R1 1e) to step up `super_admin` routes; harmless to carry before then.
   */
  aal?: 'aal1' | 'aal2';
}
