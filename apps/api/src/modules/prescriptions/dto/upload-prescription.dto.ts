import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Optional prescription measurement fields the customer may submit alongside
 * the uploaded file. All are optional — a bare file upload is valid (admin
 * processes / transcribes it later). Values mirror the `prescriptions` table
 * numeric/int columns (sphere/cyl numeric(4,2), axis int 0-180, pd numeric).
 *
 * Sent as multipart form-data fields, so numerics are coerced via
 * `@Type(() => Number)`.
 */
export class UploadPrescriptionDto {
  @ApiPropertyOptional({ description: 'Sphere (right eye / OD)', example: -1.25 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-30)
  @Max(30)
  sphere_od?: number;

  @ApiPropertyOptional({ description: 'Sphere (left eye / OS)', example: -1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-30)
  @Max(30)
  sphere_os?: number;

  @ApiPropertyOptional({ description: 'Cylinder (right eye / OD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-30)
  @Max(30)
  cyl_od?: number;

  @ApiPropertyOptional({ description: 'Cylinder (left eye / OS)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-30)
  @Max(30)
  cyl_os?: number;

  @ApiPropertyOptional({ description: 'Axis (right eye / OD), 0-180' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  axis_od?: number;

  @ApiPropertyOptional({ description: 'Axis (left eye / OS), 0-180' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  axis_os?: number;

  @ApiPropertyOptional({ description: 'Pupillary distance (mm)', example: 62 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(120)
  pd?: number;

  @ApiPropertyOptional({
    description: 'Order this prescription is attached to (optional)',
    format: 'uuid',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  order_id?: string;
}
