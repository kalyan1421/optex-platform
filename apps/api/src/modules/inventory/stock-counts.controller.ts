import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { StockCountsService } from './stock-counts.service';
import { ScanStockCountDto, StartStockCountDto, StockCountDto } from './dto/stock-count.dto';

/**
 * Physical stock counts — R2 sub-phase 2d. Mounted at `/api/admin/stock-counts`
 * (global prefix applied in `main.ts`). Every route requires
 * `inventory.count`, held by `inventory_manager` and `super_admin`
 * (migration 0026).
 */
@ApiTags('stock-counts')
@ApiBearerAuth()
@Controller('admin/stock-counts')
export class StockCountsController {
  constructor(private readonly stockCounts: StockCountsService) {}

  @RequirePermission('inventory.count')
  @Get()
  @ApiOperation({ summary: 'List stock counts' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['in_progress', 'completed', 'cancelled'] })
  @ApiOkResponse({ type: [StockCountDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ): Promise<StockCountDto[]> {
    return this.stockCounts.findAllForAdmin({ branchId, status }, user);
  }

  @RequirePermission('inventory.count')
  @Get(':id')
  @ApiOperation({ summary: 'Get a stock count with its lines' })
  @ApiOkResponse({ type: StockCountDto })
  @ApiNotFoundResponse({ description: 'Stock count not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<StockCountDto> {
    return this.stockCounts.findById(id, user);
  }

  @RequirePermission('inventory.count')
  @Post()
  @ApiOperation({ summary: 'Start a count — snapshots every serial the system believes is at this branch' })
  @ApiCreatedResponse({ type: StockCountDto })
  start(@Body() dto: StartStockCountDto, @CurrentUser() actorUser: AuthUser): Promise<StockCountDto> {
    return this.stockCounts.start(dto, actorUser);
  }

  @RequirePermission('inventory.count')
  @Patch(':id/scan')
  @ApiOperation({ summary: 'Record scanned serials against an in-progress count — callable repeatedly' })
  @ApiOkResponse({ type: StockCountDto })
  @ApiNotFoundResponse({ description: 'Stock count not found' })
  scan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScanStockCountDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<StockCountDto> {
    return this.stockCounts.scan(id, dto.scans, actorUser);
  }

  @RequirePermission('inventory.count')
  @Post(':id/accept')
  @ApiOperation({
    summary: 'Accept a count — writes off what is missing, relocates what was mistracked, creates what was never recorded',
  })
  @ApiOkResponse({ type: StockCountDto })
  @ApiNotFoundResponse({ description: 'Stock count not found' })
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actorUser: AuthUser): Promise<StockCountDto> {
    return this.stockCounts.accept(id, actorUser);
  }
}
