import { PartialType } from '@nestjs/swagger';
import { CreatePromoBannerDto } from './create-promo-banner.dto';

/**
 * Body for `PATCH /admin/promo-banners/:id`. Every `promo_banners` column from
 * the create DTO becomes optional; the global `whitelist` pipe strips unknown
 * keys.
 */
export class UpdatePromoBannerDto extends PartialType(CreatePromoBannerDto) {}
