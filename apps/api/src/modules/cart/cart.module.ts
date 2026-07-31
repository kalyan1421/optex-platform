import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

/**
 * CART module — server-side persistent cart for storefront customers.
 *
 * Get-or-create cart, add/update/remove items joined to product details, and
 * promo-code apply/clear with computed subtotal, discount, VAT, and total. All
 * routes are authed (no `@Public()`); ownership is enforced in code via the
 * caller's `customers.id`. Relies on the global `SupabaseModule` for the
 * service-role client and the global auth guards.
 */
@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
