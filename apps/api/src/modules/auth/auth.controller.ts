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
import { PermissionsService } from '../permissions/permissions.service';
import { AuthFlowService } from './auth-flow.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthResult, MeView } from './dto/auth-views';

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
  constructor(
    private readonly auth: AuthFlowService,
    private readonly permissions: PermissionsService,
  ) {}

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

  // F-22 FIX: both password-reset endpoints go through the API rather than the
  // browser talking to Supabase directly — the last customer-facing auth flow
  // that still bypassed it. Same 10/min ceiling as login/signup/refresh: this
  // is the credential surface, and email-bombing a victim's inbox is the abuse
  // case here rather than password guessing.
  @Throttle({ default: { ttl: 60_000, limit: authRateLimit } })
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password-reset email' })
  @ApiOkResponse({
    description: 'Always succeeds — never reveals whether the email is registered',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.requestPasswordReset(dto.email);
    // Deliberately the same message regardless of whether GoTrue actually found
    // an account — matching its own behaviour, not layering a leak on top of it.
    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  // NOT @Public(): the bearer token here is the short-lived recovery session
  // Supabase attaches to the reset-link redirect, and SupabaseAuthGuard
  // validating it before the handler runs is the same "throttle -> authenticate"
  // pipeline every other route gets, not a special case.
  @Throttle({ default: { ttl: 60_000, limit: authRateLimit } })
  @Post('reset-password')
  @HttpCode(204)
  @ApiBearerAuth('supabase')
  @ApiOperation({ summary: 'Set a new password using a reset-link recovery session' })
  async resetPassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    const token = this.bearer(authorization);
    await this.auth.resetPassword(token, dto.password);
  }

  @Get('me')
  @ApiBearerAuth('supabase')
  @ApiOperation({ summary: 'The authenticated user, its branch, and its full permission set' })
  @ApiOkResponse({ description: 'Current user' })
  async me(@CurrentUser() user: AuthUser): Promise<MeView> {
    const permissions = user.role
      ? await this.permissions.getPermissions(user.role)
      : new Set<string>();
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: null,
      role: user.role ?? null,
      branchId: user.branchId ?? null,
      permissions: Array.from(permissions),
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
