import { ApiProperty } from '@nestjs/swagger';

/** A `staff_users` row with its role and branch names embedded, for the admin table. */
export class AdminStaffDto {
  @ApiProperty({ description: 'staff_users id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Linked auth.users id (uuid).', format: 'uuid' })
  auth_user_id!: string;

  @ApiProperty({ description: 'Full name.' })
  full_name!: string;

  @ApiProperty({ description: 'Email address.' })
  email!: string;

  @ApiProperty({ description: 'Role id, e.g. "branch_manager".' })
  role_id!: string;

  @ApiProperty({ description: 'Human-readable role name, e.g. "Branch Manager".' })
  role_name!: string;

  @ApiProperty({
    description: 'Branch id, when this role is branch-scoped.',
    nullable: true,
  })
  branch_id!: string | null;

  @ApiProperty({
    description: 'Branch name, when this role is branch-scoped.',
    nullable: true,
  })
  branch_name!: string | null;

  @ApiProperty({
    description: 'When an admin deactivated this account, or null if active.',
    nullable: true,
  })
  deactivated_at!: string | null;

  @ApiProperty({ description: 'When this staff account was created (ISO 8601).' })
  created_at!: string;
}

/**
 * A `roles` row, for populating the role picker in the Staff admin page.
 * Exposed via the API rather than hardcoded in the frontend — SPEC-08's
 * "adding a role must not require a deploy" only holds end-to-end if the UI
 * reads the role list from the database too.
 */
export class RoleDto {
  @ApiProperty({ description: 'Role id, e.g. "branch_manager".' })
  id!: string;

  @ApiProperty({ description: 'Human-readable name, e.g. "Branch Manager".' })
  name!: string;

  @ApiProperty({ description: 'What this role is for.' })
  description!: string;

  @ApiProperty({ description: 'Whether this role requires a branch assignment.' })
  is_branch_scoped!: boolean;
}
