import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

/**
 * Global authentication guard.
 *
 * Routes decorated with `@Public()` pass straight through. Otherwise a
 * `Authorization: Bearer <token>` header is required; the token is verified
 * against Supabase Auth and the resolved principal is attached to
 * `request.user` for downstream guards/decorators.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    request.user = await this.supabase.verifyAccessToken(token);
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers['authorization'];
    if (!header) {
      return null;
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    return token.trim();
  }
}
