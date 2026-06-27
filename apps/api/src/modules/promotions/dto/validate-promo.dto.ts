import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * Body for `POST /promo/validate`. The customer submits a promo `code` and,
 * optionally, the current cart `subtotalKes` so the API can compute the
 * resulting discount amount.
 */
export class ValidatePromoDto {
  @ApiProperty({
    description: 'Promo code to validate (case-insensitive, matched uppercased).',
    example: 'WELCOME10',
    maxLength: 64,
  })
  @IsString()
  @Length(1, 64)
  code!: string;

  @ApiPropertyOptional({
    description:
      'Current cart subtotal in KES. When supplied, the response includes the computed discount amount.',
    example: 4500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotalKes?: number;
}
