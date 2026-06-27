import { PartialType } from '@nestjs/swagger';
import { CreatePromoCodeDto } from './create-promo-code.dto';

/**
 * Body for `PATCH /admin/promo-codes/:id`. Every `promo_codes` column from the
 * create DTO becomes optional; the global `whitelist` pipe strips unknown keys.
 */
export class UpdatePromoCodeDto extends PartialType(CreatePromoCodeDto) {}
