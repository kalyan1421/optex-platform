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
import { Public, Roles } from '../../auth/decorators';
import { BranchesService, type BranchRow } from './branches.service';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

/**
 * Retail branch directory. Listing and single-branch reads are public (used by
 * the storefront's "find a store" view); writes require `super_admin`.
 *
 * Mounted at `/api/branches` (global prefix applied in `main.ts`).
 */
@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  /**
   * Lists active branches, ordered by name. Optional `q` filters by a
   * case-insensitive match on name or address (area).
   */
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

  /** Returns a single branch by id; 404 when it does not exist. */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by id' })
  @ApiOkResponse({ description: 'The branch', type: BranchDto })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<BranchRow> {
    return this.branches.findById(id);
  }

  /** Creates a branch. Admin only. */
  @Roles('super_admin')
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a branch (super_admin)' })
  @ApiCreatedResponse({ description: 'The created branch', type: BranchDto })
  create(@Body() dto: CreateBranchDto): Promise<BranchRow> {
    return this.branches.create(dto);
  }

  /** Patches an existing branch. Admin only. 404 when missing. */
  @Roles('super_admin')
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a branch (super_admin)' })
  @ApiOkResponse({ description: 'The updated branch', type: BranchDto })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchRow> {
    return this.branches.update(id, dto);
  }

  /** Deletes a branch. Admin only. 404 when missing. */
  @Roles('super_admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a branch (super_admin)' })
  @ApiNoContentResponse({ description: 'Branch deleted' })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.branches.remove(id);
  }
}
