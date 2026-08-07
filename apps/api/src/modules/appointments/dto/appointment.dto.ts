import { ApiProperty } from '@nestjs/swagger';

/**
 * `appt_status` enum from `0001_init_schema.sql`:
 *   ('pending','confirmed','rescheduled','cancelled','completed')
 * Mirrored here exactly — not imported from `@optex/db`, per module rules.
 */
export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'rescheduled',
  'cancelled',
  'completed',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Schema default for a freshly booked appointment (`appointments.status`). */
export const DEFAULT_APPOINTMENT_STATUS: AppointmentStatus = 'pending';

/**
 * `appointments.type` is a free-text column in the schema; the SOW recognizes
 * these three appointment kinds. Mirrors `packages/db/src/queries/appointments.ts`.
 */
export const APPOINTMENT_TYPES = ['eye_test', 'frame_fitting', 'consultation'] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

/**
 * A row of the `appointments` table. Hand-mirrored from the `packages/db` row
 * type (`scheduled_at` is a single `timestamptz`; the API splits/combines it
 * into `date` + `time` at the edges).
 */
export class AppointmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  customer_id!: string | null;

  @ApiProperty({ format: 'uuid' })
  branch_id!: string;

  @ApiProperty({
    description: 'Appointment kind (eye_test | frame_fitting | consultation).',
    example: 'eye_test',
  })
  type!: string;

  @ApiProperty({
    description: 'Scheduled instant (UTC ISO-8601 timestamptz).',
    example: '2026-06-20T06:30:00.000Z',
  })
  scheduled_at!: string;

  @ApiProperty({ enum: APPOINTMENT_STATUSES })
  status!: AppointmentStatus;

  @ApiProperty({ nullable: true })
  contact_name!: string | null;

  @ApiProperty({ nullable: true })
  contact_phone!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Row creation instant (UTC ISO-8601).' })
  created_at!: string;
}

/**
 * An appointment as returned by `GET /admin/appointments` — the base row plus
 * the customer and branch names resolved, so the admin panel has more than
 * uuids to render (gap G-9). `customer` is null for admin-created walk-in
 * bookings, which carry `contact_name`/`contact_phone` instead.
 */
export interface AdminAppointmentDto extends AppointmentDto {
  customer: { full_name: string | null; email: string | null; phone: string | null } | null;
  branch: { name: string } | null;
}
