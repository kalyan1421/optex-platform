import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body for `POST /api/payments/mpesa/query` — STK push status query.
 * Resolves the live status of a previously-initiated STK push.
 */
export class MpesaQueryDto {
  @ApiProperty({
    description: 'CheckoutRequestID returned by the STK push initiation',
    example: 'ws_CO_17062026123456789',
  })
  @IsString()
  @IsNotEmpty()
  checkoutRequestId!: string;
}
