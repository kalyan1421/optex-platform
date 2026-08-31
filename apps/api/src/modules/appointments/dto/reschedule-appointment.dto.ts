import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { IsCalendarDate } from './is-calendar-date';

/** ISO calendar date `YYYY-MM-DD`. */
/** 24h clock time `HH:MM`. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Body for `PATCH /appointments/:id/reschedule` (and admin reschedule). Moves
 * the booking to a new `date` + `time`; the slot is re-validated for conflicts.
 */
export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'New calendar date (YYYY-MM-DD).', example: '2026-06-21' })
  @IsString()
  @IsCalendarDate()
  date!: string;

  @ApiProperty({ description: 'New slot start time as 24h HH:MM.', example: '11:00' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'time must be 24h HH:MM' })
  time!: string;
}
