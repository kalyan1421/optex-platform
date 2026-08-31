import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Body for `POST /cart/items`. Adds a product to the caller's cart, or
 * increments its quantity if the same product (with the same lens option) is
 * already present.
 */
export class AddCartItemDto {
  @ApiProperty({ description: 'Product UUID to add to the cart' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Quantity to add (defaults to 1)',
    default: 1,
    minimum: 1,
    maximum: 100,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quantity?: number = 1;

  @ApiPropertyOptional({ description: 'Per-line lens/frame configuration.' })
  @IsObject()
  @IsOptional()
  lensOption?: Record<string, unknown>;
}
