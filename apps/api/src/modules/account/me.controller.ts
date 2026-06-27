import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AccountService } from './account.service';
import { MeProfileDto } from './dto/me-profile.dto';
import { UpdateMeDto } from './dto/update-me.dto';

/**
 * Authenticated customer self-service ("me"). Mounted at `/api/me` (global
 * prefix applied in `main.ts`). Both routes require a valid Supabase JWT;
 * the caller can only ever read/write their own profile because every query
 * is scoped to `@CurrentUser().id`.
 */
@ApiTags('account')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly account: AccountService) {}

  @Get()
  @ApiOperation({ summary: "Get the current customer's profile" })
  @ApiOkResponse({ type: MeProfileDto, description: 'Current profile' })
  getMe(@CurrentUser() user: AuthUser): Promise<MeProfileDto> {
    return this.account.getProfile(user);
  }

  @Patch()
  @ApiOperation({ summary: "Update the current customer's profile" })
  @ApiOkResponse({ type: MeProfileDto, description: 'Updated profile' })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<MeProfileDto> {
    return this.account.updateProfile(user, dto);
  }
}
