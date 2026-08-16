import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PermissionsService } from '../modules/permissions/permissions.service';
import type { AuthUser } from './auth-user';
import { PERMISSION_KEY } from './decorators';

/**
 * Global authorization guard. Runs after `SupabaseAuthGuard`.
 *
 * If a route has no `@RequirePermission()` metadata it is allowed (authn
 * already happened). Otherwise the caller's role must hold that permission in
 * `role_permissions` — the CR-01 R1 matrix (migration 0025), editable as data
 * rather than requiring a deploy to add a role or grant.
 *
 * NOT yet enforcing the `super_admin` MFA step-up here (SPEC-08: "2FA | Super
 * Admin") — that lands with R1 sub-phase 1e, once `GOTRUE_MFA_*` is configured
 * and a real `aal2` exists to check against. Adding it now would 403 every
 * existing super_admin session, since none has enrolled MFA yet. `AuthUser.aal`
 * is already threaded through in anticipation of that check landing here.
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

    return true;
  }
}
