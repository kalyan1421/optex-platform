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
import { CurrentUser, Public } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AuthFlowService } from './auth-flow.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RefreshDto } from './dto/refresh.dto';
import type { AuthResult, AuthUserView } from './dto/auth-views';

/**
 * Auth proxy, mounted at `/api/auth`. Lets the frontends authenticate entirely
 * through the OPTEX API (no direct Supabase calls). login/signup/refresh are
 * `@Public()` (pre-auth); logout/me require a valid Bearer token.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthFlowService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Email/password sign-in' })
  @ApiOkResponse({ description: 'Session + user' })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Create a customer account' })
  @ApiOkResponse({ description: 'Session (if confirmation off) + user' })
  signup(@Body() dto: SignupDto): Promise<AuthResult> {
    return this.auth.signup(dto.email, dto.password, dto.fullName);
  }

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
