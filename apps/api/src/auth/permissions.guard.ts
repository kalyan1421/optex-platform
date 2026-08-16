import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionsService } from '../modules/permissions/permissions.service';
import type { AuthUser } from './auth-user';
import { PERMISSION_KEY } from './decorators';

/**
 * Off switch for the `super_admin` MFA step-up check below, for exactly one
 * reason: the API e2e suite signs super_admin fixtures straight in with
 * password auth (aal1) and has no interactive authenticator app to complete a
 * real TOTP challenge with. Same idiom as `AUTH_RATE_LIMIT` (auth.controller.ts)
 * — a production-safe default (enforced unless explicitly turned off), not a
 * feature flag for end users. See `apps/api/test/setup-env.ts`.
 */
const MFA_ENFORCEMENT_ENABLED = process.env.MFA_ENFORCEMENT_ENABLED !== 'false';

/**
 * Global authorization guard. Runs after `SupabaseAuthGuard`.
 *
 * If a route has no `@RequirePermission()` metadata it is allowed (authn
 * already happened). Otherwise the caller's role must hold that permission in
 * `role_permissions` — the CR-01 R1 matrix (migration 0025), editable as data
 * rather than requiring a deploy to add a role or grant.
 *
 * R1 1e: additionally requires `aal2` for `super_admin` on any
 * permission-gated route (SPEC-08: "2FA | Super Admin") — a valid-but-
 * unverified super_admin token (curl, Postman, a compromised admin-panel
 * dependency) cannot reach a privileged route directly, independent of
 * whatever `apps/admin/middleware.ts` does. Checked after the permission
 * grant, not before: a caller who fails the permission check should see
 * "insufficient permissions", not a confusing MFA prompt for a route they
 * were never going to reach anyway.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user?.role) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const granted = await this.permissions.getPermissions(user.role);
    if (!granted.has(requiredPermission)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (MFA_ENFORCEMENT_ENABLED && user.role === 'super_admin' && user.aal !== 'aal2') {
      throw new ForbiddenException(
        'This action requires step-up authentication (2FA) — complete your authenticator app challenge and try again',
      );
    }

    return true;
  }
}
