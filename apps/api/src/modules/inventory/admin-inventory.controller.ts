import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { InventoryService } from './inventory.service';
import { InventoryResponseDto, UpdateStockDto } from './dto/inventory.dto';

/**
 * Super-admin stock management. Mounted at `/api/admin/inventory` (global
 * prefix applied in `main.ts`). Every route requires `inventory.*`, enforced
 * by the global `PermissionsGuard` via `@RequirePermission`. Both routes are
 * branch-scoped server-side for Branch Manager (R1 1b) — see
 * `inventory.service.ts`.
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
  list(@CurrentUser() user: AuthUser): Promise<InventoryResponseDto> {
    return this.inventory.listForAdmin(user);
  }

  @RequirePermission('inventory.write')
  @Patch()
  @ApiOperation({ summary: 'Set stock for one product at one branch' })
  @ApiOkResponse({ description: 'The updated stock row' })
  setStock(
    @Body() dto: UpdateStockDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ product_id: string; branch_id: string; stock: number }> {
    return this.inventory.setStock(dto, user);
  }
}
