import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

/** Discount kinds supported by the `discount_kind` Postgres enum. */
export enum DiscountKind {
  Percent = 'percent',
  Fixed = 'fixed',
}

/**
 * Body for `POST /admin/promo-codes`. Field names mirror the `promo_codes`
 * columns exactly so the service can pass the DTO straight to an insert.
 */
export class CreatePromoCodeDto {
  @ApiProperty({
    description: 'Unique promo code. Stored uppercased.',
    example: 'WELCOME10',
    maxLength: 64,
  })
  @IsString()
  @Length(1, 64)
  code!: string;

  @ApiProperty({
    description: "Discount type: 'percent' applies value as a percentage; 'fixed' applies value as KES.",
    enum: DiscountKind,
    example: DiscountKind.Percent,
  })
  @IsEnum(DiscountKind)
  discount_type!: DiscountKind;

  @ApiProperty({
    description: 'Discount value. Percentage (0-100) for percent codes, KES amount for fixed codes. Must be > 0.',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    description: 'Restrict the code to a single product category.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Maximum total redemptions across all customers. Null/omitted means unlimited.',
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_uses?: number;

  @ApiPropertyOptional({
    description: 'ISO timestamp before which the code is not yet valid.',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp after which the code has expired.',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @ApiPropertyOptional({
    description: 'Whether the code is active. Defaults to true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
