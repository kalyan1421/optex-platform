import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Body for `POST /api/payments/pesapal/initiate`.
 *
 * The order must belong to the caller and be `pending_payment` (enforced
 * server-side). The charged amount is the order's `total_kes`.
 */
export class PesapalInitiateDto {
  @ApiProperty({ description: 'Order id (uuid) to pay for', format: 'uuid' })
  @IsUUID()
  orderId!: string;
}
