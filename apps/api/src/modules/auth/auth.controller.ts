import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AuthFlowService } from './auth-flow.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshDto } from './dto/refresh.dto';
import type { AuthResult, AuthUserView } from './dto/auth-views';

/**
 * Requests per minute allowed on the credential endpoints, per address.
 *
 * 10 is the production default — tight enough to make online password guessing
 * useless, loose enough that a real person retrying a typo never notices.
 * `AUTH_RATE_LIMIT` overrides it, which the e2e suite needs: it signs up
 * hundreds of throwaway accounts from 127.0.0.1 in a single process and would
 * otherwise spend most of its run being (correctly) rate-limited.
 *
 * Resolved PER REQUEST rather than read once into a `const`. Decorator
 * arguments are evaluated when the module is first imported, so a constant
 * would freeze whatever the environment happened to hold at import time — which
 * silently made the limit untestable and would equally defeat any future
 * runtime reconfiguration. `@Throttle` accepts `Resolvable<number>` precisely
 * for this.
 */
const authRateLimit = (): number => Number(process.env.AUTH_RATE_LIMIT ?? 10);

/**
 * Auth proxy, mounted at `/api/auth`. Lets the frontends authenticate entirely
 * through the OPTEX API (no direct Supabase calls). login/signup/refresh are
 * `@Public()` (pre-auth); logout/me require a valid Bearer token.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthFlowService) {}

  // F-01 FIX: the credential endpoints are pre-auth, so `UserAwareThrottlerGuard`
  // has no bearer token to key on and falls back to the caller's address. They
  // previously inherited only the loose global limit, which is no brute-force
  // ceiling at all. These three tighten the global bucket to 10/min for their
  // own routes — an override, not an extra bucket, because every bucket declared
  // in `ThrottlerModule.forRoot` applies to the entire API.
  @Throttle({ default: { ttl: 60_000, limit: authRateLimit } })
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Email/password sign-in' })
  @ApiOkResponse({ description: 'Session + user' })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Throttle({ default: { ttl: 60_000, limit: authRateLimit } })
  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiOkResponse({ description: 'Session (if confirmation off) + user' })
  signup(@Body() dto: SignupDto): Promise<AuthResult> {
    return this.auth.signup(dto.email, dto.password, dto.fullName);
  }

  @Throttle({ default: { ttl: 60_000, limit: authRateLimit } })
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new session' })
  @ApiOkResponse({ description: 'Fresh session + user' })
  refresh(@Body() dto: RefreshDto): Promise<AuthResult> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth('supabase')
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Headers('authorization') authorization?: string): Promise<void> {
    const token = this.bearer(authorization);
    await this.auth.logout(token);
  }

  @Get('me')
  @ApiBearerAuth('supabase')
  @ApiOperation({ summary: 'The authenticated user from the bearer token' })
  @ApiOkResponse({ description: 'Current user' })
  me(@CurrentUser() user: AuthUser): AuthUserView {
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: null,
      role: user.role ?? null,
    };
  }

  private bearer(authorization?: string): string {
    const [scheme, token] = (authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    return token.trim();
  }
}
