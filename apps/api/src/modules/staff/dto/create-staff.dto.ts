import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `POST /admin/staff`.
 *
 * `roleId` is a free-form string, not a `@IsIn(...)` against a hardcoded list —
 * roles are data (`roles` table, CR-01 R1), and a service-layer lookup is what
 * validates it exists, so adding a role stays a data change, not a deploy that
 * also has to touch this DTO.
 */
export class CreateStaffDto {
  @ApiProperty({ example: 'jane@optex.co.ke' })
  @IsEmail()
  email!: string;

  // bcrypt (GoTrue) caps the password at 72 bytes, same as SignupDto.
  @ApiProperty({ description: 'Initial password. The new staff member can change it later.' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Jane Wanjiku' })
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'branch_manager', description: 'A `roles.id` value.' })
  @IsString()
  roleId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when the role is branch-scoped (Branch Manager, Branch Staff).',
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
