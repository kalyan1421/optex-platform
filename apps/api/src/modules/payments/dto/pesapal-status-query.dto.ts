import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query for `GET /api/payments/pesapal/status?orderTrackingId=...`.
 */
export class PesapalStatusQueryDto {
  @ApiProperty({
    description: 'Pesapal OrderTrackingId returned by initiate',
    example: 'b945e4af-80a5-4ea2-8b3e-1c1e1d1f2a3b',
  })
  @IsString()
  @IsNotEmpty()
  orderTrackingId!: string;
}
