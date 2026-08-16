import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { AuthUser } from '../../auth/auth-user';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';

/**
 * A row of the `branches` table (Kenya schema `0001_init_schema.sql`).
 * Hand-mirrored from `packages/db` row types — not imported, per module rules.
 */
export interface BranchRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  hours: Record<string, unknown> | null;
  is_active: boolean;
  capacity: number;
  created_at: string;
}

/** Columns selected for every branch response. */
const BRANCH_COLUMNS =
  'id, slug, name, address, phone, lat, lng, hours, is_active, capacity, created_at';

/**
 * Data access for retail branches. Reads/writes the `branches` table through
 * the service-role Supabase client. Mirrors `packages/db/src/queries/branches.ts`
 * patterns without importing the workspace package.
 */
@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Lists active branches ordered by name. When `q` is provided, filters by a
   * case-insensitive match against either `name` or `address`.
   */
  /**
   * Every branch, active or not, for the admin panel (gap G-3).
   * `findActive` is the public listing and must stay active-only.
   */
  async findAllForAdmin(q?: string): Promise<BranchRow[]> {
    let query = this.supabase.client
      .from('branches')
      .select(BRANCH_COLUMNS)
      .order('name', { ascending: true });

    const term = q?.trim();
    if (term) {
      const pattern = `%${this.escapeLike(term)}%`;
      query = query.or(`name.ilike.${pattern},address.ilike.${pattern}`);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list branches (admin): ${error.message}`);
      throw new InternalServerErrorException('Failed to list branches');
    }
    return (data ?? []) as BranchRow[];
  }

  async findActive(q?: string): Promise<BranchRow[]> {
    let query = this.supabase.client
      .from('branches')
      .select(BRANCH_COLUMNS)
      .eq('is_active', true)
      .order('name', { ascending: true });

    const term = q?.trim();
    if (term) {
      const pattern = `%${this.escapeLike(term)}%`;
      query = query.or(`name.ilike.${pattern},address.ilike.${pattern}`);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to list branches: ${error.message}`);
      throw new InternalServerErrorException('Failed to list branches');
    }
    return (data ?? []) as BranchRow[];
  }

  /**
   * Returns a single branch by id. Throws 404 when no row matches. Active and
   * inactive branches are both returned (admin may link to an inactive branch).
   */
  async findById(id: string): Promise<BranchRow> {
    const { data, error } = await this.supabase.client
      .from('branches')
      .select(BRANCH_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch branch ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch branch');
    }
    if (!data) {
      throw new NotFoundException(`Branch ${id} not found`);
    }
    return data as BranchRow;
  }

  /**
   * Creates a branch. Maps a duplicate `slug` (unique constraint) to 400.
   */
  async create(dto: CreateBranchDto, actorUser: AuthUser): Promise<BranchRow> {
    const { data, error } = await this.supabase.client
      .from('branches')
      .insert(dto)
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(`A branch with slug "${dto.slug}" already exists`);
      }
      this.logger.error(`Failed to create branch: ${error.message}`);
      throw new InternalServerErrorException('Failed to create branch');
    }
    const created = data as BranchRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'branches.create',
      resourceType: 'branches',
      resourceId: created.id,
      after: created,
    });
    return created;
  }

  /**
   * Patches an existing branch. Throws 404 when the branch is missing and 400
   * on a duplicate slug.
   */
  async update(id: string, dto: UpdateBranchDto, actorUser: AuthUser): Promise<BranchRow> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }

    // Ensure the branch exists first so we return a 404 rather than a silent no-op.
    const before = await this.findById(id);

    const { data, error } = await this.supabase.client
      .from('branches')
      .update(dto)
      .eq('id', id)
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(`A branch with slug "${dto.slug}" already exists`);
      }
      this.logger.error(`Failed to update branch ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update branch');
    }
    const after = data as BranchRow;
    await this.auditLog.record({
      actor: actorUser,
      action: 'branches.update',
      resourceType: 'branches',
      resourceId: id,
      before,
      after,
    });
    return after;
  }

  /**
   * Deletes a branch by id. Throws 404 when the branch does not exist.
   */
  async remove(id: string, actorUser: AuthUser): Promise<void> {
    // Confirm existence so the caller gets a 404 instead of a no-op delete.
    const before = await this.findById(id);

    const { error } = await this.supabase.client.from('branches').delete().eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete branch ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete branch');
    }

    await this.auditLog.record({
      actor: actorUser,
      action: 'branches.delete',
      resourceType: 'branches',
      resourceId: id,
      before,
    });
  }

  /**
   * Makes user input safe inside a PostgREST `or(...)` filter string.
   *
   * Two separate concerns, and only the first was handled before:
   *   - `%` and `_` are `ilike` wildcards, escaped so they match literally.
   *   - `,` `.` `(` `)` are PostgREST's own filter DELIMITERS. Left unescaped,
   *     a term like `x,is_active.eq.false` injects an extra OR condition and
   *     changes which rows the query returns. Same class as the confirmed
   *     injection on the payments path (CODE-REVIEW C-2). Stripped to spaces,
   *     matching the approach already used in customers.service.ts.
   */
  private escapeLike(value: string): string {
    return value.replace(/[(),.]/g, ' ').replace(/[%_]/g, (match) => `\\${match}`);
  }
}
