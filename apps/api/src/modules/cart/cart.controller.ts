import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { CartService, CartView } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ApplyPromoDto } from './dto/apply-promo.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/**
 * Server-side cart for the authenticated storefront customer. Every route
 * requires a valid JWT (global auth guard; no `@Public()` here). The cart is
 * resolved from the caller's identity, so no cart id is ever accepted from the
 * client. Mounted at `/api/cart` (global `api` prefix applied in `main.ts`).
 */
@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get (or create) the caller's cart, fully computed" })
  @ApiOkResponse({ description: 'The cart with items, totals, and any promo' })
  getCart(@CurrentUser('id') authUserId: string): Promise<CartView> {
    return this.cart.getCart(authUserId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add a product to the cart (or increment quantity)' })
  @ApiOkResponse({ description: 'The updated cart' })
  addItem(@CurrentUser('id') authUserId: string, @Body() dto: AddCartItemDto): Promise<CartView> {
    return this.cart.addItem(authUserId, dto.productId, dto.quantity ?? 1);
  }

  @Patch('items/:id')
  @ApiOperation({
    summary: 'Set a cart line quantity (0 removes it)',
  })
  @ApiOkResponse({ description: 'The updated cart' })
  updateItem(
    @CurrentUser('id') authUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cart.updateItem(authUserId, id, dto.quantity);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove a line from the cart' })
  @ApiOkResponse({ description: 'The updated cart' })
  removeItem(
    @CurrentUser('id') authUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CartView> {
    return this.cart.removeItem(authUserId, id);
  }

  @Post('apply-promo')
  @ApiOperation({ summary: 'Validate and apply a promo code to the cart' })
  @ApiOkResponse({ description: 'The updated cart with the applied discount' })
  applyPromo(@CurrentUser('id') authUserId: string, @Body() dto: ApplyPromoDto): Promise<CartView> {
    return this.cart.applyPromo(authUserId, dto.code);
  }

  @Delete('promo')
  @ApiOperation({ summary: 'Clear the applied promo from the cart' })
  @ApiOkResponse({ description: 'The updated cart with no discount' })
  clearPromo(@CurrentUser('id') authUserId: string): Promise<CartView> {
    return this.cart.clearPromo(authUserId);
  }
}
