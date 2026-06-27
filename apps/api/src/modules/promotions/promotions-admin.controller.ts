import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PromotionsService } from './promotions.service';

/**
 * Super-admin management of promo codes and promo banners. Mounted at
 * `/api/admin`. Every route is gated by `@Roles('super_admin')` on top of the
 * global JWT guard.
 */
@ApiTags('promotions')
@Roles('super_admin')
@Controller('admin')
export class PromotionsAdminController {
  constructor(private readonly promotions: PromotionsService) {}

  // ─── Promo codes ──────────────────────────────────────────────────────────

  /** List all promo codes, newest first. */
  @Get('promo-codes')
  @ApiOperation({ summary: 'List all promo codes' })
  @ApiOkResponse({ description: 'Array of promo codes' })
  listCodes(): Promise<unknown[]> {
    return this.promotions.listCodes();
  }

  /** Create a new promo code. */
  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a promo code' })
  @ApiOkResponse({ description: 'The created promo code' })
  createCode(@Body() dto: CreatePromoCodeDto): Promise<unknown> {
    return this.promotions.createCode(dto);
  }

  /** Update an existing promo code. */
  @Patch('promo-codes/:id')
  @ApiOperation({ summary: 'Update a promo code' })
  @ApiOkResponse({ description: 'The updated promo code' })
  updateCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
  ): Promise<unknown> {
    return this.promotions.updateCode(id, dto);
  }

  /** Delete a promo code. */
  @Delete('promo-codes/:id')
  @ApiOperation({ summary: 'Delete a promo code' })
  @ApiOkResponse({ description: 'Deletion confirmation' })
  deleteCode(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; deleted: true }> {
    return this.promotions.deleteCode(id);
  }

  // ─── Promo banners ──────────────────────────────────────────────────────

  /** List all promo banners ordered by `sort_order`. */
  @Get('promo-banners')
  @ApiOperation({ summary: 'List all promo banners' })
  @ApiOkResponse({ description: 'Array of promo banners' })
  listBanners(): Promise<unknown[]> {
    return this.promotions.listBanners();
  }

  /** Create a new promo banner. */
  @Post('promo-banners')
  @ApiOperation({ summary: 'Create a promo banner' })
  @ApiOkResponse({ description: 'The created promo banner' })
  createBanner(@Body() dto: CreatePromoBannerDto): Promise<unknown> {
    return this.promotions.createBanner(dto);
  }

  /** Update an existing promo banner. */
  @Patch('promo-banners/:id')
  @ApiOperation({ summary: 'Update a promo banner' })
  @ApiOkResponse({ description: 'The updated promo banner' })
  updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoBannerDto,
  ): Promise<unknown> {
    return this.promotions.updateBanner(id, dto);
  }

  /** Delete a promo banner. */
  @Delete('promo-banners/:id')
  @ApiOperation({ summary: 'Delete a promo banner' })
  @ApiOkResponse({ description: 'Deletion confirmation' })
  deleteBanner(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; deleted: true }> {
    return this.promotions.deleteBanner(id);
  }
}
