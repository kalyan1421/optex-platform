import { Module } from '@nestjs/common';
import { PromotionsAdminController } from './promotions-admin.controller';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

/**
 * Promotions feature module: customer promo-code validation plus super-admin
 * CRUD for promo codes and promo banners. `SupabaseService` is provided by the
 * global `SupabaseModule`, so no imports are needed here.
 */
@Module({
  controllers: [PromotionsController, PromotionsAdminController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
