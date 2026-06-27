import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape returned by the `me` endpoints. Mirrors the editable + identity columns
 * of the `customers` table. When no `customers` row exists yet, only `id` and
 * `email` are populated from the JWT identity.
 */
export class MeProfileDto {
  @ApiProperty({
    description:
      "Customer's auth user id (Supabase `auth.users.id`). Stable identity.",
    example: '3f1a7b2c-9d4e-4c8a-bb12-0a1b2c3d4e5f',
  })
  id!: string;

  @ApiProperty({
    description: "Customer's email.",
    nullable: true,
    example: 'wanjiru@example.com',
  })
  email!: string | null;

  @ApiProperty({
    description: "Customer's full name.",
    nullable: true,
    example: 'Wanjiru Kamau',
  })
  full_name!: string | null;

  @ApiProperty({
    description: "Customer's contact phone.",
    nullable: true,
    example: '+254712345678',
  })
  phone!: string | null;

  @ApiProperty({
    description:
      'Whether a backing `customers` row exists. False when the response is a minimal token-only identity.',
    example: true,
  })
  has_profile!: boolean;
}
