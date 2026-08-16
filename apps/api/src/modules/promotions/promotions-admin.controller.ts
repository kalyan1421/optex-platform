import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PromotionsService } from './promotions.service';

/**
 * Super-admin management of promo codes and promo banners. Mounted at
 * `/api/admin`. Every route is gated by `promotions.read`/`promotions.write`
 * (`@RequirePermission`) on top of the global JWT guard.
 */
@ApiTags('promotions')
@Controller('admin')
export class PromotionsAdminController {
  constructor(private readonly promotions: PromotionsService) {}

  // ─── Promo codes ──────────────────────────────────────────────────────────

  /** List all promo codes, newest first. */
  @RequirePermission('promotions.read')
  @Get('promo-codes')
  @ApiOperation({ summary: 'List all promo codes' })
  @ApiOkResponse({ description: 'Array of promo codes' })
  listCodes(): Promise<unknown[]> {
    return this.promotions.listCodes();
  }

  /** Create a new promo code. */
  @RequirePermission('promotions.write')
  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a promo code' })
  @ApiOkResponse({ description: 'The created promo code' })
  createCode(
    @Body() dto: CreatePromoCodeDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<unknown> {
    return this.promotions.createCode(dto, actorUser);
  }

  /** Update an existing promo code. */
  @RequirePermission('promotions.write')
  @Patch('promo-codes/:id')
  @ApiOperation({ summary: 'Update a promo code' })
  @ApiOkResponse({ description: 'The updated promo code' })
  updateCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<unknown> {
    return this.promotions.updateCode(id, dto, actorUser);
  }

  /** Delete a promo code. */
  @RequirePermission('promotions.write')
  @Delete('promo-codes/:id')
  @ApiOperation({ summary: 'Delete a promo code' })
  @ApiOkResponse({ description: 'Deletion confirmation' })
  deleteCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<{ id: string; deleted: true }> {
    return this.promotions.deleteCode(id, actorUser);
  }

  // ─── Promo banners ──────────────────────────────────────────────────────

  /** List all promo banners ordered by `sort_order`. */
  @RequirePermission('promotions.read')
  @Get('promo-banners')
  @ApiOperation({ summary: 'List all promo banners' })
  @ApiOkResponse({ description: 'Array of promo banners' })
  listBanners(): Promise<unknown[]> {
    return this.promotions.listBanners();
  }

  /** Create a new promo banner. */
  @RequirePermission('promotions.write')
  @Post('promo-banners')
  @ApiOperation({ summary: 'Create a promo banner' })
  @ApiOkResponse({ description: 'The created promo banner' })
  createBanner(
    @Body() dto: CreatePromoBannerDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<unknown> {
    return this.promotions.createBanner(dto, actorUser);
  }

  /** Update an existing promo banner. */
  @RequirePermission('promotions.write')
  @Patch('promo-banners/:id')
  @ApiOperation({ summary: 'Update a promo banner' })
  @ApiOkResponse({ description: 'The updated promo banner' })
  updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoBannerDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<unknown> {
    return this.promotions.updateBanner(id, dto, actorUser);
  }

  /** Delete a promo banner. */
  @RequirePermission('promotions.write')
  @Delete('promo-banners/:id')
  @ApiOperation({ summary: 'Delete a promo banner' })
  @ApiOkResponse({ description: 'Deletion confirmation' })
  deleteBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<{ id: string; deleted: true }> {
    return this.promotions.deleteBanner(id, actorUser);
  }
}
