import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { StaffService } from './staff.service';
import { AdminStaffDto, RoleDto } from './dto/staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { SetStaffStatusDto } from './dto/set-staff-status.dto';

/**
 * Super-admin staff directory — CR-01 R1's user-management screen. Mounted at
 * `/api/admin/staff` (global prefix applied in `main.ts`). Every route
 * requires `staff.manage`, held only by Super Admin in the R1 matrix — a
 * self-service staff-management surface is exactly the self-escalation risk
 * the 2026-07-22 `app_metadata` fix closed, so this stays the tightest grant
 * in the system.
 */
@ApiTags('staff')
@ApiBearerAuth()
@RequirePermission('staff.manage')
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts with their role and branch' })
  @ApiOkResponse({ type: [AdminStaffDto], description: 'Staff, newest first' })
  list(): Promise<AdminStaffDto[]> {
    return this.staff.listForAdmin();
  }

  @Get('roles')
  @ApiOperation({ summary: 'List the 7 roles, for the role picker' })
  @ApiOkResponse({ type: [RoleDto], description: 'Roles, alphabetical' })
  listRoles(): Promise<RoleDto[]> {
    return this.staff.listRoles();
  }

  @Post()
  @ApiOperation({ summary: 'Create a staff account and its role/branch assignment' })
  @ApiOkResponse({ type: AdminStaffDto, description: 'The created staff row' })
  create(@Body() dto: CreateStaffDto, @CurrentUser() actorUser: AuthUser): Promise<AdminStaffDto> {
    return this.staff.create(dto, actorUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Update a staff member's role, branch, or name",
    description:
      'Role/branch changes sync `app_metadata` via the Supabase Admin API before persisting ' +
      "the directory row, so `verifyAccessToken()` reflects the change on the caller's very " +
      'next request — no re-login required. A caller cannot modify their own account here.',
  })
  @ApiOkResponse({ type: AdminStaffDto, description: 'The updated staff row' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<AdminStaffDto> {
    return this.staff.update(id, dto, actorUser);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: "Set a staff member's account status (active/deactivated)",
    description:
      'Deactivating bans the linked auth user via the Supabase Admin API — not just a display ' +
      'flag — so a deactivated staff member genuinely cannot sign in.',
  })
  @ApiOkResponse({ type: AdminStaffDto, description: 'The updated staff row' })
  setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetStaffStatusDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<AdminStaffDto> {
    return this.staff.setStatus(id, dto.status, actorUser);
  }
}
