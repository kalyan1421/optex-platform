import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Delivery / shipping address captured at checkout. Persisted verbatim onto the
 * order's `shipping` jsonb column ({ name, phone, address, city, county, postal })
 * which matches the schema comment on `orders.shipping` in
 * `Backend/supabase/migrations/0001_init_schema.sql`.
 */
export class ShippingAddressDto {
  @ApiProperty({ description: 'Recipient full name', example: 'Jane Wanjiku' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Recipient phone (E.164 preferred, e.g. +2547XXXXXXXX)',
    example: '+254712345678',
  })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({
    description: 'Street address / building / estate',
    example: 'Moi Avenue, Bruce House, 4th Floor',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  address!: string;

  @ApiProperty({ description: 'City / town', example: 'Nairobi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ description: 'County', example: 'Nairobi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  county!: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '00100' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  postal?: string;
}
