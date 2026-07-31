import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromoValidationResultDto } from './dto/promo-validation-result.dto';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { PromotionsService } from './promotions.service';

/**
 * Customer-facing promotions endpoints. Mounted at `/api/promo`. Requires a
 * valid JWT (the global auth guard applies; not marked `@Public()`), so only
 * signed-in customers can validate codes against their cart.
 */
@ApiTags('promotions')
@Controller('promo')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /**
   * Validate a promo code and, when a subtotal is supplied, compute the
   * resulting KES discount. Returns `valid: false` (200) for unknown,
   * inactive, out-of-window, or exhausted codes rather than throwing.
   */
  @Post('validate')
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
