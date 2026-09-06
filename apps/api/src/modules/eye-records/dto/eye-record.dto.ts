import { ApiProperty } from '@nestjs/swagger';

/**
 * `eye_record_status` enum from `0037_eye_records.sql`:
 *   ('submitted','reviewed','archived')
 * Mirrored here exactly — not imported from `@optex/db`, per module rules.
 */
export const EYE_RECORD_STATUSES = ['submitted', 'reviewed', 'archived'] as const;

export type EyeRecordStatus = (typeof EYE_RECORD_STATUSES)[number];

/** Schema default for a freshly submitted intake (`eye_records.status`). */
export const DEFAULT_EYE_RECORD_STATUS: EyeRecordStatus = 'submitted';

/** A row of the `eye_records` table. */
export class EyeRecordDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customer_id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  appointment_id!: string | null;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description:
      'Branch the intake was taken at, copied from the linked appointment at insert (0038). Null when no appointment was booked alongside it.',
  })
  branch_id!: string | null;

  @ApiProperty()
  full_name!: string;

  @ApiProperty({ nullable: true })
  age!: number | null;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ type: [String] })
  conditions!: string[];

  @ApiProperty({ nullable: true })
  history_notes!: string | null;

  @ApiProperty({ nullable: true }) sphere_od!: number | null;
  @ApiProperty({ nullable: true }) sphere_os!: number | null;
  @ApiProperty({ nullable: true }) cyl_od!: number | null;
  @ApiProperty({ nullable: true }) cyl_os!: number | null;
  @ApiProperty({ nullable: true }) axis_od!: number | null;
  @ApiProperty({ nullable: true }) axis_os!: number | null;
  @ApiProperty({ nullable: true }) add_od!: number | null;
  @ApiProperty({ nullable: true }) add_os!: number | null;
  @ApiProperty({ nullable: true }) pd_od!: number | null;
  @ApiProperty({ nullable: true }) pd_os!: number | null;

  @ApiProperty({ enum: EYE_RECORD_STATUSES })
  status!: EyeRecordStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  reviewed_by!: string | null;

  @ApiProperty({ nullable: true })
  reviewed_at!: string | null;

  @ApiProperty()
  created_at!: string;
}

/**
 * An eye record as returned by the admin endpoints — the base row plus the
 * resolved branch name, so the review queue can show where the intake was
 * taken without a second round trip per row. Mirrors `AdminAppointmentDto`.
 */
export class AdminEyeRecordDto extends EyeRecordDto {
  @ApiProperty({ type: 'object', nullable: true, additionalProperties: false })
  branch!: { name: string } | null;
}
