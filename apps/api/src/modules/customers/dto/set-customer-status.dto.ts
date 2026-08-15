import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Values a customer's account status can be set to (migration 0019). */
export const CUSTOMER_STATUSES = ['active', 'deactivated'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/**
 * Body for `PATCH /admin/customers/:id` (super_admin only).
 *
 * `deactivated_at` is server-controlled: stamped when a customer moves to
 * `deactivated` and cleared when moved back to `active`, mirroring
 * `UpdatePrescriptionStatusDto`'s `processed_at` handling. The linked
 * `auth.users` row is banned/unbanned in lockstep so a deactivated customer
 * cannot sign in — this isn't just a display flag.
 */
export class SetCustomerStatusDto {
  @ApiProperty({
    enum: CUSTOMER_STATUSES,
    description: 'New account status.',
    example: 'deactivated',
  })
  @IsIn(CUSTOMER_STATUSES)
  status!: CustomerStatus;
}
