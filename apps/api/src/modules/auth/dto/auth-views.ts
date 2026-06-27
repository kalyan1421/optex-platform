/** Normalized authenticated user (subset of the Supabase user). */
export interface AuthUserView {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
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
