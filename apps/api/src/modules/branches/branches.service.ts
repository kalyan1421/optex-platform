import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
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
  created_at: string;
}

/** Columns selected for every branch response. */
const BRANCH_COLUMNS =
  'id, slug, name, address, phone, lat, lng, hours, is_active, created_at';

/**
 * Data access for retail branches. Reads/writes the `branches` table through
 * the service-role Supabase client. Mirrors `packages/db/src/queries/branches.ts`
 * patterns without importing the workspace package.
 */
@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lists active branches ordered by name. When `q` is provided, filters by a
   * case-insensitive match against either `name` or `address`.
   */
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
  async create(dto: CreateBranchDto): Promise<BranchRow> {
    const { data, error } = await this.supabase.client
      .from('branches')
      .insert(dto)
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          `A branch with slug "${dto.slug}" already exists`,
        );
      }
      this.logger.error(`Failed to create branch: ${error.message}`);
      throw new InternalServerErrorException('Failed to create branch');
    }
    return data as BranchRow;
  }

  /**
   * Patches an existing branch. Throws 404 when the branch is missing and 400
   * on a duplicate slug.
   */
  async update(id: string, dto: UpdateBranchDto): Promise<BranchRow> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }

    // Ensure the branch exists first so we return a 404 rather than a silent no-op.
    await this.findById(id);

    const { data, error } = await this.supabase.client
      .from('branches')
      .update(dto)
      .eq('id', id)
      .select(BRANCH_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          `A branch with slug "${dto.slug}" already exists`,
        );
      }
      this.logger.error(`Failed to update branch ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update branch');
    }
    return data as BranchRow;
  }

  /**
   * Deletes a branch by id. Throws 404 when the branch does not exist.
   */
  async remove(id: string): Promise<void> {
    // Confirm existence so the caller gets a 404 instead of a no-op delete.
    await this.findById(id);

    const { error } = await this.supabase.client
      .from('branches')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete branch ${id}: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete branch');
    }
  }

  /** Escapes PostgREST `ilike` wildcards so user input is treated literally. */
  private escapeLike(value: string): string {
    return value.replace(/[%_]/g, (match) => `\\${match}`);
  }
}
