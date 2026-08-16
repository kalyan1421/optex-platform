import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { InventoryService } from './inventory.service';
import { InventoryResponseDto, UpdateStockDto } from './dto/inventory.dto';

/**
 * Super-admin stock management. Mounted at `/api/admin/inventory` (global
 * prefix applied in `main.ts`). Every route requires `inventory.*`, enforced
 * by the global `PermissionsGuard` via `@RequirePermission`. Currently takes
 * no branch parameter and returns every branch's stock unconditionally —
 * scoping this to a Branch Manager's own branch (while leaving Inventory
 * Manager's cross-branch view intact) is R1 sub-phase 1b, not yet done here.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @RequirePermission('inventory.read')
  @Get()
  @ApiOperation({ summary: 'List stock per product per branch, with branch columns' })
  @ApiOkResponse({ type: InventoryResponseDto, description: 'Branches and stock rows' })
  list(): Promise<InventoryResponseDto> {
    return this.inventory.listForAdmin();
  }

  @RequirePermission('inventory.write')
  @Patch()
  @ApiOperation({ summary: 'Set stock for one product at one branch' })
  @ApiOkResponse({ description: 'The updated stock row' })
  setStock(
    @Body() dto: UpdateStockDto,
  ): Promise<{ product_id: string; branch_id: string; stock: number }> {
    return this.inventory.setStock(dto);
  }
}
