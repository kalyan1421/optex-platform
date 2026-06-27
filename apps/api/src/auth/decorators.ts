import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/** Metadata key marking a route as publicly accessible (skips auth guard). */
export const IS_PUBLIC_KEY = 'isPublic';

/** Metadata key carrying the list of roles allowed to access a route. */
export const ROLES_KEY = 'roles';

/**
 * Marks a controller or handler as public — `SupabaseAuthGuard` will skip it.
 *
 * @example
 *   @Public()
 *   @Get('health')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restricts a route to the given roles. Enforced by `RolesGuard`.
 *
 * @example
 *   @Roles('super_admin')
 *   @Get('admin/metrics')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

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
