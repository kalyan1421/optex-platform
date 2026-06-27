import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
  async signup(
    email: string,
    password: string,
    fullName?: string,
  ): Promise<AuthResult> {
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

  // ── internals ──────────────────────────────────────────────────────────────

  private async post<T>(
    path: string,
    body: unknown,
    bearer?: string,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/auth/v1/${path}`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      this.logger.error(`GoTrue request failed: ${(e as Error).message}`);
      throw new BadRequestException('Auth service is unavailable.');
    }

    const text = await res.text();
    const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;

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
