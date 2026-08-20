import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators';
import { PromoValidationResultDto } from './dto/promo-validation-result.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { PromotionsService } from './promotions.service';

/** High rate limit for anonymous catalogue reads — same reasoning as branches/catalog (F-01). */
const CATALOGUE_READ_LIMIT = Number(process.env.CATALOGUE_RATE_LIMIT ?? 2000);

/**
 * Customer-facing promotions endpoints. Mounted at `/api/promo`. The promo-code
 * validation requires a valid JWT (the global auth guard applies; not marked
 * `@Public()`), so only signed-in customers can validate codes against their cart.
 *
 * The `/api/banners` route is `@Public()` — it is used by the storefront home
 * page to render the hero banner carousel without any authentication.
 */
@ApiTags('promotions')
@Controller()
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /**
   * Returns all currently active promo banners ordered by `sort_order`.
   * Filters: `is_active = true` AND start/end date window includes now.
   * Used server-side by the storefront's BannerCarousel component.
   */
  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get('banners')
  @ApiOperation({ summary: 'List active hero banners (storefront)' })
  @ApiOkResponse({ description: 'Array of active promo banners ordered by sort_order' })
  listActiveBanners(): Promise<unknown[]> {
    return this.promotions.listActiveBanners();
  }

  /**
   * Validate a promo code and, when a subtotal is supplied, compute the
   * resulting KES discount. Returns `valid: false` (200) for unknown,
   * inactive, out-of-window, or exhausted codes rather than throwing.
   */
  @Post('promo/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a promo code and compute its discount' })
  @ApiOkResponse({
    description: 'Validation outcome',
    type: PromoValidationResultDto,
  })
  validate(@Body() dto: ValidatePromoDto): Promise<PromoValidationResultDto> {
    return this.promotions.validate(dto);
  }
}
