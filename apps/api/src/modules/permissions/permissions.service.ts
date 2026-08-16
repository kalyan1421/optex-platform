import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * How long a role's resolved permission set is trusted before re-querying
 * `role_permissions`. SPEC-08's "granting a permission is a data change, not a
 * deploy" only needs the change to land within about a minute, not
 * immediately — so this trades a little propagation lag for skipping a DB
 * round trip on every single permission-gated request.
 */
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

/**
 * Resolves a role's permission set from `role_permissions` (migration 0025),
 * the CR-01 R1 permission matrix. The sole consumer today is
 * `PermissionsGuard`; kept as its own injectable rather than a method on the
 * guard so the cache is a single shared instance across requests, not
 * per-guard-invocation.
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly supabase: SupabaseService) {}

  async getPermissions(roleId: string): Promise<Set<string>> {
    const cached = this.cache.get(roleId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const { data, error } = await this.supabase.client
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);

    if (error) {
      this.logger.error(`Failed to load permissions for role "${roleId}": ${error.message}`);
      throw error;
    }

    const permissions = new Set((data ?? []).map((row) => row.permission_id));
    this.cache.set(roleId, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
    return permissions;
  }
}
