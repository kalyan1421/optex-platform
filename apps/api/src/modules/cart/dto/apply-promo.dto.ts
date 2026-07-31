import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /cart/apply-promo`. The code is matched case-insensitively
 * (uppercased) against the `promo_codes` table.
 */
export class ApplyPromoDto {
  @ApiProperty({ description: 'Promo code to apply', example: 'WELCOME10' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;
}
