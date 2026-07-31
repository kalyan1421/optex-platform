import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape returned by the branch endpoints. Mirrors the `branches` table row
 * (Kenya schema: `0001_init_schema.sql`). `hours` is the raw jsonb object keyed
 * by short weekday name; consumers format it for display.
 */
export class BranchDto {
  @ApiProperty({
    description: 'Branch id (uuid).',
    example: '3f1a7b2c-9d4e-4c8a-bb12-0a1b2c3d4e5f',
  })
  id!: string;

  @ApiProperty({
    description: 'URL-friendly unique identifier.',
    example: 'nairobi-cbd',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name of the branch.',
    example: 'Optex Opticians — Nairobi CBD',
  })
  name!: string;

  @ApiProperty({
    description: 'Street / postal address.',
    nullable: true,
    example: 'Kimathi Street, Nairobi',
  })
  address!: string | null;

  @ApiProperty({
    description: 'Contact phone.',
    nullable: true,
    example: '+254712345678',
  })
  phone!: string | null;

  @ApiProperty({
    description: 'Latitude (decimal degrees).',
    nullable: true,
    example: -1.286389,
  })
  lat!: number | null;

  @ApiProperty({
    description: 'Longitude (decimal degrees).',
    nullable: true,
    example: 36.817223,
  })
  lng!: number | null;

  @ApiProperty({
    description:
      'Opening hours keyed by short weekday name; each day is ["HH:MM","HH:MM"] or null when closed.',
    nullable: true,
    example: {
      mon: ['09:00', '18:00'],
      sat: ['10:00', '16:00'],
      sun: null,
    },
  })
  hours!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Whether the branch is active / publicly listed.',
    example: true,
  })
  is_active!: boolean;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601).',
    example: '2026-06-17T00:00:00.000Z',
  })
  created_at!: string;
}
