import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../../auth/auth-user';
import type { AdminStaffDto, RoleDto } from './dto/staff.dto';
import type { CreateStaffDto } from './dto/create-staff.dto';
import type { UpdateStaffDto } from './dto/update-staff.dto';
import type { StaffStatus } from './dto/set-staff-status.dto';

/** Columns selected from `staff_users`, with the role and branch names joined. */
const STAFF_COLUMNS =
  'id, auth_user_id, full_name, email, role_id, branch_id, deactivated_at, created_at, ' +
  'role:roles(name), branch:branches(name)';

/** A 100-year ban — GoTrue has no permanent-ban value. Mirrors `CustomersService`. */
const BAN_FOREVER = '876000h';
/** GoTrue's own sentinel for "not banned". */
const BAN_LIFT = 'none';

/** Shape Supabase returns before flattening the embedded role/branch joins. */
type RawStaffRow = {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role_id: string;
  branch_id: string | null;
  deactivated_at: string | null;
  created_at: string;
  role: { name: string } | { name: string }[] | null;
  branch: { name: string } | { name: string }[] | null;
};

/**
 * STAFF domain logic (super-admin only — `staff.manage`).
 *
 * Owns two things in lockstep: the `staff_users` directory row, and the
 * linked `auth.users` row's `app_metadata` (`role`, `branch_id`) — the JWT
 * claims every other guard/check in the system trusts. `app_metadata` is
 * synced FIRST, staff_users SECOND, same ordering rationale as
 * `CustomersService#setStatusAsAdmin`: never record a role/branch change that
 * didn't actually take effect on the auth side.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listForAdmin(): Promise<AdminStaffDto[]> {
    const { data, error } = await this.supabase.client
      .from('staff_users')
      .select(STAFF_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list staff: ${error.message}`);
      throw new InternalServerErrorException('Failed to load staff');
    }

    return (data ?? []).map((row) => this.toDto(row as unknown as RawStaffRow));
  }

  /** The 7 roles, for the Staff page's role picker. */
  async listRoles(): Promise<RoleDto[]> {
    const { data, error } = await this.supabase.client
      .from('roles')
      .select('id, name, description, is_branch_scoped')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to list roles: ${error.message}`);
      throw new InternalServerErrorException('Failed to load roles');
    }
    return (data ?? []) as RoleDto[];
  }

  /**
   * Creates a staff account: the `auth.users` row (via the Admin API, with
   * `role`/`branch_id` already in `app_metadata` at creation) and the
   * `staff_users` directory row. If the directory insert fails after the auth
   * user was created, best-effort deletes the orphaned auth user rather than
   * leaving a staff account with no directory entry — logged, not thrown,
   * since the original failure is the one the caller needs to see.
   */
  async create(dto: CreateStaffDto, actorUser: AuthUser): Promise<AdminStaffDto> {
    const role = await this.loadRole(dto.roleId);
    this.assertBranchRequirement(role, dto.branchId);

    const { data: created, error: createError } = await this.supabase.client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      app_metadata: {
        role: dto.roleId,
        ...(dto.branchId ? { branch_id: dto.branchId } : {}),
      },
      user_metadata: { full_name: dto.fullName },
    });
    if (createError || !created?.user) {
      if (createError?.message?.toLowerCase().includes('already been registered')) {
        throw new ConflictException('A user with that email already exists');
      }
      this.logger.error(`Failed to create staff auth user: ${createError?.message}`);
      throw new InternalServerErrorException('Failed to create staff account');
    }

    const { data: staffRow, error: insertError } = await this.supabase.client
      .from('staff_users')
      .insert({
        auth_user_id: created.user.id,
        role_id: dto.roleId,
        branch_id: dto.branchId ?? null,
        full_name: dto.fullName,
        email: dto.email,
        created_by: actorUser.id,
      })
      .select('id')
      .single<{ id: string }>();

    if (insertError || !staffRow) {
      this.logger.error(
        `Created auth user ${created.user.id} but failed to insert staff_users row: ` +
          `${insertError?.message}. Deleting the orphaned auth user.`,
      );
      const { error: cleanupError } = await this.supabase.client.auth.admin.deleteUser(
        created.user.id,
      );
      if (cleanupError) {
        this.logger.error(
          `Failed to clean up orphaned auth user ${created.user.id}: ${cleanupError.message}`,
        );
      }
      throw new InternalServerErrorException('Failed to create staff account');
    }

    const created_staff = await this.fetchOneForAdmin(staffRow.id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'staff.create',
      resourceType: 'staff_users',
      resourceId: staffRow.id,
      after: created_staff,
    });
    return created_staff;
  }

  /**
   * Updates role/branch/name. A caller cannot modify their own staff account
   * through this endpoint — self-demotion or self-deactivation via a bug in
   * an admin UI is exactly the kind of accidental lockout this guards against.
   */
  async update(id: string, dto: UpdateStaffDto, actorUser: AuthUser): Promise<AdminStaffDto> {
    const existing = await this.loadExisting(id);
    this.assertNotSelf(existing.auth_user_id, actorUser);
    const before = await this.fetchOneForAdmin(id);

    const nextRoleId = dto.roleId ?? existing.role_id;
    const branchProvided = 'branchId' in dto;
    const nextBranchId = branchProvided ? (dto.branchId ?? null) : existing.branch_id;

    if (dto.roleId || branchProvided) {
      const role = await this.loadRole(nextRoleId);
      this.assertBranchRequirement(role, nextBranchId ?? undefined);

      const { error: syncError } = await this.supabase.client.auth.admin.updateUserById(
        existing.auth_user_id,
        {
          app_metadata: {
            role: nextRoleId,
            ...(nextBranchId ? { branch_id: nextBranchId } : {}),
          },
        },
      );
      if (syncError) {
        this.logger.error(`Failed to sync app_metadata for staff ${id}: ${syncError.message}`);
        throw new InternalServerErrorException('Failed to update staff account');
      }
    }

    const { error: updateError } = await this.supabase.client
      .from('staff_users')
      .update({
        role_id: nextRoleId,
        branch_id: nextBranchId,
        ...(dto.fullName ? { full_name: dto.fullName } : {}),
      })
      .eq('id', id);

    if (updateError) {
      this.logger.error(`Failed to update staff ${id}: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to update staff account');
    }

    const after = await this.fetchOneForAdmin(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'staff.update',
      resourceType: 'staff_users',
      resourceId: id,
      before,
      after,
    });
    return after;
  }

  /** Same ban-first-then-flag-second ordering as `CustomersService#setStatusAsAdmin`. */
  async setStatus(id: string, status: StaffStatus, actorUser: AuthUser): Promise<AdminStaffDto> {
    const existing = await this.loadExisting(id);
    this.assertNotSelf(existing.auth_user_id, actorUser);

    const currentStatus: StaffStatus = existing.deactivated_at ? 'deactivated' : 'active';
    if (currentStatus === status) {
      return this.fetchOneForAdmin(id);
    }

    const { error: banError } = await this.supabase.client.auth.admin.updateUserById(
      existing.auth_user_id,
      { ban_duration: status === 'deactivated' ? BAN_FOREVER : BAN_LIFT },
    );
    if (banError) {
      this.logger.error(
        `Failed to ${status === 'deactivated' ? 'ban' : 'unban'} auth user for staff ${id}: ${banError.message}`,
      );
      throw new InternalServerErrorException('Failed to update staff status');
    }

    const { error: updateError } = await this.supabase.client
      .from('staff_users')
      .update({ deactivated_at: status === 'deactivated' ? new Date().toISOString() : null })
      .eq('id', id);

    if (updateError) {
      this.logger.error(`Failed to update staff ${id}: ${updateError.message}`);
      throw new InternalServerErrorException('Failed to update staff status');
    }

    const after = await this.fetchOneForAdmin(id);
    await this.auditLog.record({
      actor: actorUser,
      action: 'staff.status_change',
      resourceType: 'staff_users',
      resourceId: id,
      metadata: { status },
      after,
    });
    return after;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private assertNotSelf(existingAuthUserId: string, actorUser: AuthUser): void {
    if (existingAuthUserId === actorUser.id) {
      throw new BadRequestException(
        'Cannot change your own role, branch, or status — ask another Super Admin',
      );
    }
  }

  private async loadRole(roleId: string): Promise<{ id: string; is_branch_scoped: boolean }> {
    const { data, error } = await this.supabase.client
      .from('roles')
      .select('id, is_branch_scoped')
      .eq('id', roleId)
      .maybeSingle<{ id: string; is_branch_scoped: boolean }>();

    if (error) {
      this.logger.error(`Failed to load role ${roleId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to load role');
    }
    if (!data) {
      throw new BadRequestException(`Unknown role: ${roleId}`);
    }
    return data;
  }

  private assertBranchRequirement(
    role: { is_branch_scoped: boolean },
    branchId: string | undefined,
  ): void {
    if (role.is_branch_scoped && !branchId) {
      throw new BadRequestException('This role requires a branch');
    }
    if (!role.is_branch_scoped && branchId) {
      throw new BadRequestException('This role is not branch-scoped and cannot take a branch');
    }
  }

  private async loadExisting(id: string): Promise<{
    id: string;
    auth_user_id: string;
    role_id: string;
    branch_id: string | null;
    deactivated_at: string | null;
  }> {
    const { data, error } = await this.supabase.client
      .from('staff_users')
      .select('id, auth_user_id, role_id, branch_id, deactivated_at')
      .eq('id', id)
      .maybeSingle<{
        id: string;
        auth_user_id: string;
        role_id: string;
        branch_id: string | null;
        deactivated_at: string | null;
      }>();

    if (error) {
      this.logger.error(`Failed to load staff ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to load staff');
    }
    if (!data) {
      throw new NotFoundException('Staff member not found');
    }
    return data;
  }

  private async fetchOneForAdmin(id: string): Promise<AdminStaffDto> {
    const { data, error } = await this.supabase.client
      .from('staff_users')
      .select(STAFF_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to load staff');
    }
    if (!data) {
      throw new NotFoundException('Staff member not found');
    }
    return this.toDto(data as unknown as RawStaffRow);
  }

  /** PostgREST returns an embedded to-one join as an object or single-element array. */
  private toDto(row: RawStaffRow): AdminStaffDto {
    const roleName = Array.isArray(row.role) ? row.role[0]?.name : row.role?.name;
    const branchName = Array.isArray(row.branch) ? row.branch[0]?.name : row.branch?.name;

    return {
      id: row.id,
      auth_user_id: row.auth_user_id,
      full_name: row.full_name,
      email: row.email,
      role_id: row.role_id,
      role_name: roleName ?? row.role_id,
      branch_id: row.branch_id,
      branch_name: branchName ?? null,
      deactivated_at: row.deactivated_at,
      created_at: row.created_at,
    };
  }
}
