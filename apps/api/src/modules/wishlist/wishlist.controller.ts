import { Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { WishlistItemView, WishlistService } from './wishlist.service';

/**
 * Server-side wishlist for the authenticated storefront customer (SPEC-10
 * R2). Every route requires a valid JWT (global auth guard; no `@Public()`
 * here). Mounted at `/api/wishlist` (global `api` prefix applied in
 * `main.ts`) — mirrors `cart.controller.ts`'s conventions exactly.
 */
@ApiTags('wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's saved products" })
  @ApiOkResponse({ description: 'The caller’s wishlist, most recently saved first' })
  list(@CurrentUser('id') authUserId: string): Promise<WishlistItemView[]> {
    return this.wishlist.list(authUserId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Save a product to the wishlist (idempotent)' })
  @ApiOkResponse({ description: 'The saved product id' })
  add(
    @CurrentUser('id') authUserId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<{ productId: string }> {
    return this.wishlist.add(authUserId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist (idempotent)' })
  @ApiOkResponse({ description: 'The removed product id' })
  remove(
    @CurrentUser('id') authUserId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<{ productId: string }> {
    return this.wishlist.remove(authUserId, productId);
  }
}
