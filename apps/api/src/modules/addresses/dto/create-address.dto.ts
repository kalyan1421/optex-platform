import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A saved address's fields deliberately mirror `ShippingAddressDto`
 * (`orders/dto/shipping-address.dto.ts`) exactly — `name`, `phone`,
 * `address`, `city`, `county`, `postal` — so a saved row maps onto the
 * checkout payload with no field translation.
 */
export class CreateAddressDto {
  @ApiPropertyOptional({ description: 'Optional label, e.g. "Home" or "Office"', example: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

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
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal?: string;

  @ApiPropertyOptional({ description: 'Make this the default address', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
