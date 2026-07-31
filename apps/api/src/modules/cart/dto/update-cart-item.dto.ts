import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Body for `PATCH /cart/items/:id`. Sets the absolute quantity of a cart line.
 * A quantity of 0 (or less) removes the line entirely.
 */
export class UpdateCartItemDto {
  @ApiProperty({
    description: 'New absolute quantity. 0 removes the item from the cart.',
    minimum: 0,
    maximum: 100,
    example: 2,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  quantity!: number;
}
