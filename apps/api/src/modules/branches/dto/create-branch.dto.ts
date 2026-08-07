import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { BranchHoursDto } from './branch-hours.dto';

/**
 * Body for `POST /branches` (super_admin only). Mirrors the writable columns of
 * the `branches` table. `id` and `created_at` are server-controlled and stripped
 * by the global `whitelist` validation pipe.
 */
export class CreateBranchDto {
  @ApiProperty({
    description: 'URL-friendly unique identifier (lowercase letters, digits, hyphens).',
    example: 'nairobi-cbd',
    maxLength: 80,
  })
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric words separated by hyphens',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name of the branch.',
    example: 'Optex Opticians — Nairobi CBD',
    maxLength: 120,
  })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Street / postal address of the branch.',
    example: 'Kimathi Street, Nairobi',
    maxLength: 240,
  })
  @IsOptional()
  @IsString()
  @Length(1, 240)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Contact phone in Kenyan format (e.g. +254712345678 or 0712345678). ' +
      'Spaces, hyphens and brackets are accepted and stripped before validation.',
    example: '+254712345678',
  })
  @IsOptional()
  @IsString()
  // Humans type "+254 700 000 002" and the existing branch records are stored
  // that way, so normalise separators to a canonical form before matching
  // rather than rejecting formatting the rest of the system already contains.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s()-]/g, '') : (value as unknown),
  )
  @Matches(/^(\+?254|0)[17]\d{8}$/, {
    message: 'phone must be a valid Kenyan mobile number',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Latitude (decimal degrees, -90..90).',
    example: -1.286389,
    minimum: -90,
    maximum: 90,
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitude (decimal degrees, -180..180).',
    example: 36.817223,
    minimum: -180,
    maximum: 180,
  })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({
    description:
      'Opening hours keyed by short weekday name. Each day is ["HH:MM","HH:MM"] or null when closed.',
    type: BranchHoursDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BranchHoursDto)
  hours?: BranchHoursDto;

  @ApiPropertyOptional({
    description: 'Whether the branch is active / publicly listed. Defaults to true.',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
