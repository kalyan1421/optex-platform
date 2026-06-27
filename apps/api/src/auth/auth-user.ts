/**
 * Authenticated principal attached to `request.user` by `SupabaseAuthGuard`.
 */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}
