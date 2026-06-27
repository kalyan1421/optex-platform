import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

/**
 * Body for `POST /api/payments/mpesa/stk-push`.
 *
 * The order must belong to the caller and be `pending_payment`; this is
 * enforced server-side, never trusted from the client. The amount charged is
 * the order's `total_kes` — never a client-supplied figure.
 */
export class MpesaStkPushDto {
  @ApiProperty({ description: 'Order id (uuid) to pay for', format: 'uuid' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({
    description:
      'Payer MSISDN. Accepts 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX.',
    example: '254712345678',
  })
  @IsString()
  @IsNotEmpty()
  // Permissive at the boundary; canonicalized + strictly validated in-service.
  @Matches(/^\+?\d[\d\s-]{7,14}$/, { message: 'phone must be a valid phone number' })
  phone!: string;
}
