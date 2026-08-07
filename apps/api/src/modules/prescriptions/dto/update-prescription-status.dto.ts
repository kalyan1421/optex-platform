import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Values of the `pres_status` enum (migration 0001). */
export const PRESCRIPTION_STATUSES = ['pending', 'processed'] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

/**
 * Body for `PATCH /admin/prescriptions/:id` (super_admin only).
 *
 * `processed_at` is server-controlled: it is stamped when a prescription moves
 * to `processed` and cleared when it moves back to `pending`, so the timestamp
 * can never disagree with the status.
 */
export class UpdatePrescriptionStatusDto {
  @ApiProperty({
    enum: PRESCRIPTION_STATUSES,
    description: 'New processing status.',
    example: 'processed',
  })
  @IsIn(PRESCRIPTION_STATUSES)
  status!: PrescriptionStatus;
}
