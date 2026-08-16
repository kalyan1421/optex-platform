import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env';

export interface VerifiedUser {
  id: string;
  email?: string;
  role?: string;
  branchId?: string;
  aal?: 'aal1' | 'aal2';
}

/**
 * Reads the `aal` claim straight out of the JWT payload — the same base64url
 * decode `auth-js` does internally, not a fresh signature check. Safe to do
 * without re-verifying: this only ever runs on a token `supabase.auth.getUser()`
 * has already vouched for a few lines above. Malformed input yields `undefined`
 * rather than throwing, since a missing/odd `aal` claim should fall back to the
 * safer "not stepped up" assumption, not fail the whole request.
 */
function decodeAal(token: string): 'aal1' | 'aal2' | undefined {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) {
    return undefined;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
      aal?: unknown;
    };
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wraps a single service-role Supabase client.
 *
 * The service-role key bypasses RLS — this client is the privileged path used
 * by the API for trusted server-side work (and later by payment webhooks to
 * write to `mpesa_transactions` / `pesapal_transactions`). Never expose it to
 * the browser.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', {
      infer: true,
    });

    this.supabase = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  onModuleInit(): void {
    this.logger.log('Supabase service-role client initialized');
  }

  /** Privileged service-role client (bypasses RLS). */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Verifies a Supabase access token (JWT) by resolving it to a user via the
   * Auth API, and normalizes the identity for guards/decorators.
   *
   * The role is read from `app_metadata.role` ONLY. `app_metadata` is
   * server-controlled (writable only via the service-role Admin API);
   * `user_metadata` is writable by the authenticated user themselves via the
   * client SDK (`auth.updateUser`), so it must never be trusted for
   * authorization — falling back to it would let any signed-up customer grant
   * themselves `super_admin`. This matches `is_super_admin()` (Postgres RLS,
   * migration 0007_security_meta.sql) and `apps/admin/middleware.ts`, which
   * both correctly check `app_metadata.role` only. `branch_id` is the same
   * trust story — `StaffModule` (R1 1c) is the only writer.
   */
  async verifyAccessToken(token: string): Promise<VerifiedUser> {
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const { user } = data;
    const role = user.app_metadata?.role as string | undefined;
    const branchId = user.app_metadata?.branch_id as string | undefined;

    return {
      id: user.id,
      email: user.email ?? undefined,
      role,
      branchId,
      aal: decodeAal(token),
    };
  }
}
