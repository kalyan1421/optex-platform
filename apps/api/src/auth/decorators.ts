import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/** Metadata key marking a route as publicly accessible (skips auth guard). */
export const IS_PUBLIC_KEY = 'isPublic';

/** Metadata key carrying the permission required to access a route. */
export const PERMISSION_KEY = 'permission';

/**
 * Marks a controller or handler as public — `SupabaseAuthGuard` will skip it.
 *
 * @example
 *   @Public()
 *   @Get('health')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts a route to callers whose role holds the given permission.
 * Enforced by `PermissionsGuard` against the data-driven `role_permissions`
 * table (CR-01 R1) — the permission vocabulary and role matrix live there,
 * not in this decorator, so granting a role a new permission is a data change,
 * not a deploy.
 *
 * @example
 *   @RequirePermission('orders.write')
 *   @Patch('admin/orders/:id/status')
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Param decorator resolving the authenticated user from the request.
 * Optionally pass a property name to extract a single field.
 *
 * @example
 *   findMe(@CurrentUser() user: AuthUser) {}
 *   findMe(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
