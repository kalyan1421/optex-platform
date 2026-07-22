import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env';

export interface VerifiedUser {
  id: string;
  email?: string;
  role?: string;
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
   * both correctly check `app_metadata.role` only.
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

    return {
      id: user.id,
      email: user.email ?? undefined,
      role,
    };
  }
}
