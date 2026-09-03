import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { InventoryService } from './inventory.service';
import { InventoryReconciliationResponseDto, InventoryResponseDto } from './dto/inventory.dto';
import { AgingSerialDto, InventorySerialDto, SerialHistoryDto } from './dto/ledger.dto';
import { LedgerService } from './ledger.service';

/**
 * Stock read view. Mounted at `/api/admin/inventory` (global prefix applied
 * in `main.ts`). Requires `inventory.read`, enforced by the global
 * `PermissionsGuard`. Branch-scoped server-side for Branch Manager (R1 1b) —
 * see `inventory.service.ts`.
 *
 * R2 removed `PATCH /admin/inventory` (`setStock`) entirely — stock is now
 * derived from the ledger. Writes live on the sibling GRN, transfers,
 * adjustments, and stock-counts controllers, each gated by its own
 * `inventory.*` permission and each producing an auditable reason.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly ledger: LedgerService,
  ) {}

  @RequirePermission('inventory.read')
  @Get()
  @ApiOperation({ summary: 'List stock per product per branch, with branch columns' })
  @ApiOkResponse({ type: InventoryResponseDto, description: 'Branches and stock rows' })
  list(@CurrentUser() user: AuthUser): Promise<InventoryResponseDto> {
    return this.inventory.listForAdmin(user);
  }

  @RequirePermission('inventory.read')
  @Get('reconciliation')
  @ApiOperation({ summary: 'Compare inventory cache stock to in-stock serial counts' })
  @ApiOkResponse({ type: InventoryReconciliationResponseDto })
  reconciliation(@CurrentUser() user: AuthUser): Promise<InventoryReconciliationResponseDto> {
    return this.inventory.reconciliation(user);
  }

  @RequirePermission('inventory.read')
  @Get('serials')
  @ApiOperation({ summary: 'List in-stock serials, for transfer and adjustment pickers' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Branch holding the units.' })
  @ApiQuery({ name: 'productId', required: false, description: 'Narrow to one product.' })
  @ApiQuery({ name: 'search', required: false, description: 'Serial number contains this.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows (1-500, default 200).' })
  @ApiOkResponse({ type: [InventorySerialDto] })
  serials(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<InventorySerialDto[]> {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.ledger.listSerials(user, { branchId, productId, search, limit: parsedLimit });
  }

  @RequirePermission('inventory.read')
  @Get('serials/:id/history')
  @ApiOperation({ summary: 'Trace one serial through every inventory movement' })
  @ApiOkResponse({ type: SerialHistoryDto })
  serialHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SerialHistoryDto> {
    return this.ledger.serialHistory(id, user);
  }

  @RequirePermission('inventory.read')
  @Get('aging')
  @ApiOperation({ summary: 'List in-stock serials ordered by oldest receipt date' })
  @ApiQuery({
    name: 'minimumDays',
    required: false,
    description: 'Only include serials at least this many days old.',
  })
  @ApiOkResponse({ type: [AgingSerialDto] })
  aging(
    @CurrentUser() user: AuthUser,
    @Query('minimumDays') minimumDays?: string,
  ): Promise<AgingSerialDto[]> {
    const parsed = minimumDays === undefined ? 0 : Number(minimumDays);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException('minimumDays must be a non-negative integer');
    }
    return this.ledger.aging(user, parsed);
  }
}
