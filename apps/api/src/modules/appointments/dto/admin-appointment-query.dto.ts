import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from './appointment.dto';
import { IsCalendarDate } from './is-calendar-date';

/** ISO calendar date `YYYY-MM-DD`. */
/**
 * Optional filters for `GET /admin/appointments`. Any combination may be
 * supplied; omitting all returns every appointment (newest first).
 */
export class AdminAppointmentQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by branch.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: APPOINTMENT_STATUSES, description: 'Filter by status.' })
  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES)
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Filter to a single calendar date (Africa/Nairobi), YYYY-MM-DD.',
    example: '2026-06-20',
  })
  @IsOptional()
  @IsString()
  @IsCalendarDate()
  date?: string;
}
