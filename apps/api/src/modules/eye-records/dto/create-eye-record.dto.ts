import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /eye-records`.
 *
 * Every prescription field is optional: the intake form tells the customer to
 * "leave blank if you'd rather we test fresh", so a record carrying only
 * identity and history is a normal submission, not a malformed one.
 *
 * Numeric bounds mirror the CHECK constraints and column precision in
 * `0037_eye_records.sql` — `numeric(4,2)` cannot hold a value outside
 * ±99.99, and rejecting at the edge here gives a 400 with a useful message
 * instead of a 500 from Postgres.
 */
export class CreateEyeRecordDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The eye_test appointment booked alongside this intake.',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ example: 'Amina Wanjiru' })
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiProperty({ example: '+254700123456' })
  @IsString()
  @Matches(/^[+\d][\d\s-]{6,19}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @ApiPropertyOptional({ format: 'email' })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: 'Female' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Selected health-history labels, e.g. ["Diabetes","Glaucoma"].',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @ArrayMaxSize(30)
  conditions?: string[];

  @ApiPropertyOptional({ description: 'Free-text past prescriptions or notes.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  historyNotes?: string;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  sphereOd?: number;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  sphereOs?: number;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  cylOd?: number;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  cylOs?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 180 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  axisOd?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 180 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  axisOs?: number;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  addOd?: number;

  @ApiPropertyOptional({ minimum: -99.99, maximum: 99.99 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-99.99)
  @Max(99.99)
  addOs?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 999.9 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999.9)
  pdOd?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 999.9 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(999.9)
  pdOs?: number;
}
