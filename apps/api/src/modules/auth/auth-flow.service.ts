import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { AuthResult, AuthUserView } from './dto/auth-views';

/** Raw Supabase user shape (only the fields we read). */
interface GoTrueUser {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string } | null;
  app_metadata?: { role?: string } | null;
}

/** Raw GoTrue token/session response. */
interface GoTrueSession {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user?: GoTrueUser;
}

/**
 * Server-side proxy for Supabase Auth (GoTrue). Lets the storefront/admin obtain
 * and refresh sessions WITHOUT ever talking to Supabase directly — they call the
 * OPTEX API, which forwards to GoTrue with the anon key and normalizes the
 * response. This keeps Supabase an internal implementation detail of the backend.
 */
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);
  private readonly baseUrl: string;
  private readonly anonKey: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.baseUrl = this.config.get('SUPABASE_URL', { infer: true });
    this.anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });
  }

  /** Email/password sign-in. */
  async login(email: string, password: string): Promise<AuthResult> {
    const data = await this.post<GoTrueSession>('token?grant_type=password', {
      email,
      password,
    });
    return this.toResult(data);
  }

  /** Create an account. Returns a session when email confirmation is off. */
  async signup(email: string, password: string, fullName?: string): Promise<AuthResult> {
    const data = await this.post<GoTrueSession>('signup', {
      email,
      password,
      data: fullName ? { full_name: fullName } : undefined,
    });
    return this.toResult(data);
  }

  /** Exchange a refresh token for a fresh session. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const data = await this.post<GoTrueSession>('token?grant_type=refresh_token', {
      refresh_token: refreshToken,
    });
    return this.toResult(data);
  }

  /** Revoke the caller's session. */
  async logout(accessToken: string): Promise<void> {
    await this.post('logout', {}, accessToken);
  }

  /**
   * Requests a password-reset email (audit F-22).
   *
   * `redirectTo` is NEVER taken from the caller — it is built server-side from
   * `WEB_APP_URL` (see `resolveResetRedirectUrl`). A client-supplied redirect
   * would let anyone who knows a victim's email address send them a genuine
   * Supabase recovery email whose link points at an attacker-controlled origin;
   * building it here closes that off entirely rather than relying on Supabase's
   * own redirect allowlist as the only defence.
   *
   * GoTrue's `/recover` endpoint always resolves 200, whether or not the email
   * is registered — that's what stops this from being an account-enumeration
   * oracle, and this method preserves it by not special-casing the response.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.post('recover', { email }, undefined, { redirect_to: this.resetRedirectUrl() });
  }

  /**
   * Sets a new password for the caller identified by `accessToken` — the
   * short-lived recovery session Supabase attaches to the reset-link redirect,
   * not an ordinary login session. GoTrue's `PUT /user` operates on whichever
   * token is presented, recovery or otherwise, so this doubles as "change my
   * password while signed in" if a future page wants that.
   */
  async resetPassword(accessToken: string, password: string): Promise<void> {
    await this.put('user', { password }, accessToken);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /**
   * Where the reset email's link points. Built from `WEB_APP_URL` — configured
   * server-side, never accepted from the request — falling back to the same
   * local dev default `main.ts` uses for CORS.
   */
  private resetRedirectUrl(): string {
    const base = this.config.get('WEB_APP_URL', { infer: true }) || 'http://localhost:1112';
    return `${base.replace(/\/$/, '')}/reset-password`;
  }

  private post<T>(
    path: string,
    body: unknown,
    bearer?: string,
    query?: Record<string, string>,
  ): Promise<T> {
    return this.send<T>('POST', path, body, bearer, query);
  }

  private put<T>(path: string, body: unknown, bearer: string): Promise<T> {
    return this.send<T>('PUT', path, body, bearer);
  }

  private async send<T>(
    method: 'POST' | 'PUT',
    path: string,
    body: unknown,
    bearer?: string,
    query?: Record<string, string>,
  ): Promise<T> {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/auth/v1/${path}${qs}`, {
        method,
        headers: {
          apikey: this.anonKey,
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.error(`GoTrue request failed: ${(e as Error).message}`);
      throw new BadRequestException(`Auth service fetch failed: ${(e as Error).message}`);
    }

    // H-1 FIX: Parse response JSON inside its own try-catch. A non-JSON body
    // (e.g. a 503 HTML error page from a proxy) must not crash the endpoint.
    let json: Record<string, unknown> = {};
    try {
      const text = await res.text();
      if (text) json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON or empty body — fall through with empty object so the
      // !res.ok branch below raises a generic error message.
    }

    if (!res.ok) {
      const msg =
        (json.error_description as string) ??
        (json.msg as string) ??
        (json.error as string) ??
        'Authentication failed';
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new UnauthorizedException(msg);
      }
      throw new BadRequestException(msg);
    }

    return json as T;
  }

  private toResult(data: GoTrueSession): AuthResult {
    // signup-with-confirmation returns the user at the top level (no session);
    // login/refresh/signup-without-confirmation nest it under `user`.
    const rawUser = data.user ?? (data as unknown as GoTrueUser);
    const user = this.toUserView(rawUser);
    const session = data.access_token
      ? {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? '',
          expiresIn: data.expires_in ?? 3600,
          tokenType: data.token_type ?? 'bearer',
          user,
        }
      : null;
    return { session, user };
  }

  private toUserView(u: GoTrueUser): AuthUserView {
    return {
      id: u.id,
      email: u.email ?? null,
      fullName: u.user_metadata?.full_name ?? null,
      // Trusted source first (server-set app_metadata), then user_metadata.
      role: u.app_metadata?.role ?? null,
    };
  }
}
