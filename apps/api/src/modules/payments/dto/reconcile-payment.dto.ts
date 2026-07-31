import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

/** Provider a reconcile target belongs to (the `:id` is its transaction PK). */
export enum ReconcileProvider {
  MPESA = 'mpesa',
  PESAPAL = 'pesapal',
}

/**
 * Body for `POST /api/admin/payments/:id/reconcile`.
 *
 * `:id` is the transaction row's `id` (uuid). Because the two provider tables
 * are separate, the admin must say which provider the row belongs to so we
 * re-query the right rail.
 */
export class ReconcilePaymentDto {
  @ApiProperty({ enum: ReconcileProvider, description: 'Payment rail to re-query' })
  @IsEnum(ReconcileProvider)
  provider!: ReconcileProvider;
}
