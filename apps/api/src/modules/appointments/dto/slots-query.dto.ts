import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

/** ISO calendar date `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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
  @Matches(DATE_PATTERN, { message: 'date must be a valid YYYY-MM-DD date' })
  date!: string;
}
