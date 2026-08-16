import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { BranchesService, type BranchRow } from './branches.service';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

/**
 * Retail branch directory. Listing and single-branch reads are public (used by
 * the storefront's "find a store" view); the admin listing needs
 * `branches.read` and writes need `branches.write`.
 *
 * Mounted at `/api/branches` (global prefix applied in `main.ts`).
 */
/**
 * Cheap, cacheable public reads — same high ceiling and same reasoning as the
 * product catalogue (F-01 / F-07): anonymous callers behind carrier-grade NAT
 * all share one IP bucket, and these queries are trivial.
 */
const CATALOGUE_READ_LIMIT = Number(process.env.CATALOGUE_RATE_LIMIT ?? 2000);

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /**
   * Lists active branches, ordered by name. Optional `q` filters by a
   * case-insensitive match on name or address (area).
   */
  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get()
  @ApiOperation({ summary: 'List active branches' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Case-insensitive filter on branch name or address/area.',
    example: 'nairobi',
  })
  @ApiOkResponse({ description: 'Active branches', type: [BranchDto] })
  list(@Query('q') q?: string): Promise<BranchRow[]> {
    return this.branches.findActive(q);
  }

  /**
   * Admin listing: every branch, active or not (gap G-3). Separate from the
   * public route rather than a flag on it — a `@Public()` endpoint must not
   * conditionally widen its result set based on a token it never verifies.
   */
  @RequirePermission('branches.read')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'List all branches including inactive (admin)' })
  @ApiOkResponse({ description: 'All branches', type: [BranchDto] })
  listAllForAdmin(@Query('q') q?: string): Promise<BranchRow[]> {
    return this.branches.findAllForAdmin(q);
  }

  /** Returns a single branch by id; 404 when it does not exist. */
  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by id' })
  @ApiOkResponse({ description: 'The branch', type: BranchDto })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<BranchRow> {
    return this.branches.findById(id);
  }

  /** Creates a branch. Admin only. */
  @RequirePermission('branches.write')
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a branch (super_admin)' })
  @ApiCreatedResponse({ description: 'The created branch', type: BranchDto })
  create(@Body() dto: CreateBranchDto, @CurrentUser() actorUser: AuthUser): Promise<BranchRow> {
    return this.branches.create(dto, actorUser);
  }

  /** Patches an existing branch. Admin only. 404 when missing. */
  @RequirePermission('branches.write')
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a branch (super_admin)' })
  @ApiOkResponse({ description: 'The updated branch', type: BranchDto })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<BranchRow> {
    return this.branches.update(id, dto, actorUser);
  }

  /** Deletes a branch. Admin only. 404 when missing. */
  @RequirePermission('branches.write')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a branch (super_admin)' })
  @ApiNoContentResponse({ description: 'Branch deleted' })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<void> {
    return this.branches.remove(id, actorUser);
  }
}
