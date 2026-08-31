import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { APPOINTMENT_TYPES, type AppointmentType } from './appointment.dto';
import { IsCalendarDate } from './is-calendar-date';

/** ISO calendar date `YYYY-MM-DD`. */
/** 24h clock time `HH:MM`. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Body for `POST /appointments`. The caller is resolved to their `customers`
 * row server-side; `date` + `time` (Africa/Nairobi local wall-clock) are
 * combined into the `scheduled_at` timestamptz.
 */
export class CreateAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ description: 'Calendar date (YYYY-MM-DD).', example: '2026-06-20' })
  @IsString()
  @IsCalendarDate()
  date!: string;

  @ApiProperty({ description: 'Slot start time as 24h HH:MM.', example: '09:30' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'time must be 24h HH:MM' })
  time!: string;

  @ApiPropertyOptional({
    enum: APPOINTMENT_TYPES,
    description: 'Appointment kind. Defaults to eye_test.',
    default: 'eye_test',
  })
  @IsOptional()
  @IsIn(APPOINTMENT_TYPES)
  type?: AppointmentType;

  @ApiPropertyOptional({ description: 'Optional customer note.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
