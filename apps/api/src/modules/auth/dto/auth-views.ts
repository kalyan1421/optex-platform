/** Normalized authenticated user (subset of the Supabase user). */
export interface AuthUserView {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
}

/**
 * `AuthUserView` plus the RBAC (CR-01 R1) fields — only `GET /auth/me`
 * resolves these, since every other auth endpoint (login/signup/refresh)
 * returns a session before any downstream `staff_users`/`role_permissions`
 * lookup would be useful.
 */
export interface MeView extends AuthUserView {
  branchId: string | null;
  /** The caller's full permission set, server-computed from `role_permissions`. */
  permissions: string[];
}

/** A session returned by login / signup / refresh. */
export interface SessionView {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: AuthUserView;
}

/**
 * Auth result. `session` is null only when signup requires email confirmation
 * (no immediate session); login/refresh always return a session.
 */
export interface AuthResult {
  session: SessionView | null;
  user: AuthUserView;
}
