import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

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
  @MaxLength(128)
  // Daraja ids are letters, digits and underscores. Constrained here as well as
  // in PaymentsService because this value reaches a database filter; the
  // service repeats the check because the webhook path has no DTO at all.
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'checkoutRequestId contains characters that are not valid in a Daraja request id',
  })
  checkoutRequestId!: string;
}
