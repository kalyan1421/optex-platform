import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

/**
 * WISHLIST module (SPEC-10) — a customer's saved-for-later products.
 * Relies on the global `SupabaseModule` (service-role client) and global
 * auth guards.
 */
@Module({
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
