import { ApiProperty } from '@nestjs/swagger';

/**
 * Response of `GET /appointments/slots`: the free `HH:MM` start times for the
 * branch on the requested date, after excluding already-booked slots.
 */
export class SlotsResponseDto {
  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ description: 'Requested calendar date (YYYY-MM-DD).', example: '2026-06-20' })
  date!: string;

  @ApiProperty({
    description: 'Free 30-minute slot start times as 24h HH:MM, ascending.',
    type: [String],
    example: ['09:00', '09:30', '10:00'],
  })
  slots!: string[];
}
