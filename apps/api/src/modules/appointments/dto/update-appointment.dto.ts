import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from './appointment.dto';
import { IsCalendarDate } from './is-calendar-date';

/** ISO calendar date `YYYY-MM-DD`. */
/** 24h clock time `HH:MM`. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Body for `PATCH /admin/appointments/:id` (super_admin). Supports confirming,
 * rescheduling, cancelling, or otherwise setting the status of any booking.
 *
 * - `status` directly sets `appointments.status` (e.g. confirm / cancel /
 *   complete). When `date` + `time` are supplied without an explicit status the
 *   service marks the booking `rescheduled`.
 * - `date` + `time` must be provided together to move the slot.
 */
export class UpdateAppointmentDto {
  @ApiPropertyOptional({ enum: APPOINTMENT_STATUSES, description: 'New status.' })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'New calendar date (YYYY-MM-DD).', example: '2026-06-21' })
  @IsOptional()
  @IsString()
  @IsCalendarDate()
  date?: string;

  @ApiPropertyOptional({ description: 'New slot start time as 24h HH:MM.', example: '11:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'time must be 24h HH:MM' })
  time?: string;
}
