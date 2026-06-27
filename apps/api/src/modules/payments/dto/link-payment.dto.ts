import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ReconcileProvider } from './reconcile-payment.dto';

/**
 * Body for `POST /api/admin/payments/:id/link`.
 *
 * Manually matches an unmatched provider transaction (`:id`) to an order by its
 * human-readable `order_number`, then credits that order. Used by admin staff to
 * resolve orphan payments the automatic reconcile couldn't tie to an order.
 */
export class LinkPaymentDto {
  @ApiProperty({
    enum: ReconcileProvider,
    description: 'Which provider table the transaction belongs to',
  })
  @IsEnum(ReconcileProvider)
  provider!: ReconcileProvider;

  @ApiProperty({
    description: 'Human-readable order number to link the payment to',
    example: 'OPX-2026-000123',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  orderNumber!: string;
}
