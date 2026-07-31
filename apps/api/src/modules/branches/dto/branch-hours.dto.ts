import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Opening hours for a single weekday, expressed as `[open, close]` 24h `HH:MM`
 * strings. A `null` slot (or omitted day) means the branch is closed that day.
 *
 * Stored in the `branches.hours` jsonb column keyed by short day name, e.g.:
 *   `{ mon: ["09:00","18:00"], tue: ["09:00","18:00"], sun: null }`
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BranchHoursDto {
  @ApiProperty({
    description: 'Monday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['09:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'mon times must be 24h HH:MM' })
  mon?: [string, string] | null;

  @ApiProperty({
    description: 'Tuesday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['09:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'tue times must be 24h HH:MM' })
  tue?: [string, string] | null;

  @ApiProperty({
    description: 'Wednesday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['09:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'wed times must be 24h HH:MM' })
  wed?: [string, string] | null;

  @ApiProperty({
    description: 'Thursday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['09:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'thu times must be 24h HH:MM' })
  thu?: [string, string] | null;

  @ApiProperty({
    description: 'Friday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['09:00', '18:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'fri times must be 24h HH:MM' })
  fri?: [string, string] | null;

  @ApiProperty({
    description: 'Saturday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: ['10:00', '16:00'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'sat times must be 24h HH:MM' })
  sat?: [string, string] | null;

  @ApiProperty({
    description: 'Sunday hours as ["HH:MM","HH:MM"], or null when closed.',
    type: [String],
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(TIME_PATTERN, { each: true, message: 'sun times must be 24h HH:MM' })
  sun?: [string, string] | null;
}
