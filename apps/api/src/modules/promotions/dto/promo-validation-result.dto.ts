import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response shape for `POST /promo/validate`. `valid` is the authoritative
 * flag; the remaining fields describe the code and, when a subtotal was
 * supplied for a valid code, the computed discount in KES.
 */
export class PromoValidationResultDto {
  @ApiProperty({
    description: 'Whether the code is currently usable.',
    example: true,
  })
  valid!: boolean;

  @ApiProperty({
    description: 'The normalized (uppercased) code that was checked.',
    example: 'WELCOME10',
  })
  code!: string;

  @ApiPropertyOptional({
    description: "Discount type from the promo record ('percent' or 'fixed'). Absent if the code does not exist.",
    example: 'percent',
    enum: ['percent', 'fixed'],
  })
  discountType?: 'percent' | 'fixed';

  @ApiPropertyOptional({
    description:
      "Raw discount value: a percentage (0-100) when discountType is 'percent', or a KES amount when 'fixed'.",
    example: 10,
  })
  discountValue?: number;

  @ApiPropertyOptional({
    description:
      'Discount amount in KES, computed from subtotalKes. Only present when the code is valid and a subtotal was provided.',
    example: 450,
  })
  discountKes?: number;

  @ApiProperty({
    description: 'Human-readable explanation of the validation outcome.',
    example: 'Promo code applied.',
  })
  message!: string;
}
