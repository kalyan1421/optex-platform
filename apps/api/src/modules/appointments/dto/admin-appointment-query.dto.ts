import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from './appointment.dto';

/** ISO calendar date `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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
  @Matches(DATE_PATTERN, { message: 'date must be a valid YYYY-MM-DD date' })
  date?: string;
}
