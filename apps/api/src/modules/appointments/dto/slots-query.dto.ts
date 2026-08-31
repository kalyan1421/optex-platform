import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { IsCalendarDate } from './is-calendar-date';

/** ISO calendar date `YYYY-MM-DD`. */
/**
 * Query params for `GET /appointments/slots`. A branch + a calendar date are
 * required; the service derives free 30-minute slots from the branch `hours`
 * for that weekday minus any already-taken appointments.
 */
export class SlotsQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Branch to query availability for.' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({
    description: 'Calendar date (Africa/Nairobi) as YYYY-MM-DD.',
    example: '2026-06-20',
  })
  @IsString()
  @IsCalendarDate()
  date!: string;
}
