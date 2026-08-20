import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { GrnService } from './grn.service';
import { CreateGrnDto, GrnDto, PostGrnDto, UpdateGrnItemsDto } from './dto/grn.dto';

/**
 * Goods-received-notes — the R2 receiving flow. Mounted at `/api/admin/grn`
 * (global prefix applied in `main.ts`). Every route requires
 * `inventory.receive`, held by `inventory_manager` and `super_admin`
 * (migration 0026).
 */
@ApiTags('grn')
@ApiBearerAuth()
@Controller('admin/grn')
export class GrnController {
  constructor(private readonly grn: GrnService) {}

  @RequirePermission('inventory.receive')
  @Get()
  @ApiOperation({ summary: 'List GRNs' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'posted'] })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiOkResponse({ type: [GrnDto] })
  list(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('branchId') branchId?: string,
  ): Promise<GrnDto[]> {
    return this.grn.findAllForAdmin({ status, supplierId, branchId });
  }

  @RequirePermission('inventory.receive')
  @Get(':id')
  @ApiOperation({ summary: 'Get a GRN with its lines' })
  @ApiOkResponse({ type: GrnDto })
  @ApiNotFoundResponse({ description: 'GRN not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<GrnDto> {
    return this.grn.findById(id);
  }

  @RequirePermission('inventory.receive')
  @Post()
  @ApiOperation({ summary: 'Create a draft GRN with its lines' })
  @ApiCreatedResponse({ type: GrnDto })
  create(@Body() dto: CreateGrnDto, @CurrentUser() actorUser: AuthUser): Promise<GrnDto> {
    return this.grn.create(dto, actorUser);
  }

  @RequirePermission('inventory.receive')
  @Patch(':id/items')
  @ApiOperation({ summary: 'Replace the lines on a still-draft GRN' })
  @ApiOkResponse({ type: GrnDto })
  @ApiNotFoundResponse({ description: 'GRN not found' })
  updateItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGrnItemsDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<GrnDto> {
    return this.grn.replaceItems(id, dto.items, actorUser);
  }

  @RequirePermission('inventory.receive')
  @Post(':id/post')
  @ApiOperation({
    summary: 'Post a draft GRN — creates one product_serials row per submitted serial and stocks them in',
  })
  @ApiOkResponse({ type: GrnDto })
  @ApiNotFoundResponse({ description: 'GRN not found' })
  post(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PostGrnDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<GrnDto> {
    return this.grn.post(id, dto, actorUser);
  }
}
