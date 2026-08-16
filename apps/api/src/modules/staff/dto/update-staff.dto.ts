import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Body for `PATCH /admin/staff/:id`. Every field optional — a caller changing
 * just the branch shouldn't have to resend the role, and vice versa.
 *
 * `branchId` accepts `null` explicitly (moving a Branch Manager off a branch,
 * or promoting someone to a non-branch-scoped role) as well as `undefined`
 * (leave unchanged) — `class-validator`'s `@IsOptional()` treats both the
 * same, so the service reads `'branchId' in dto` to tell them apart.
 */
export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'branch_manager', description: 'A `roles.id` value.' })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  fullName?: string;
}
