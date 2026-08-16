import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Values a staff account's status can be set to. Mirrors `SetCustomerStatusDto`. */
export const STAFF_STATUSES = ['active', 'deactivated'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

/**
 * Body for `PATCH /admin/staff/:id/status`.
 *
 * Same contract as `SetCustomerStatusDto`: `deactivated_at` is server-stamped,
 * and the linked `auth.users` row is banned/unbanned in lockstep via the
 * Supabase Admin API, so a deactivated staff member genuinely cannot sign in.
 */
export class SetStaffStatusDto {
  @ApiProperty({ enum: STAFF_STATUSES, description: 'New account status.' })
  @IsIn(STAFF_STATUSES)
  status!: StaffStatus;
}
