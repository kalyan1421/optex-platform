import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { InventoryService } from './inventory.service';
import { InventoryResponseDto, UpdateStockDto } from './dto/inventory.dto';

/**
 * Super-admin stock management. Mounted at `/api/admin/inventory` (global
 * prefix applied in `main.ts`). Every route requires `role === 'super_admin'`,
 * enforced by the global `RolesGuard` via `@Roles`.
 */
@ApiTags('inventory')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List stock per product per branch, with branch columns' })
  @ApiOkResponse({ type: InventoryResponseDto, description: 'Branches and stock rows' })
  list(): Promise<InventoryResponseDto> {
    return this.inventory.listForAdmin();
  }

  @Patch()
  @ApiOperation({ summary: 'Set stock for one product at one branch' })
  @ApiOkResponse({ description: 'The updated stock row' })
  setStock(
    @Body() dto: UpdateStockDto,
  ): Promise<{ product_id: string; branch_id: string; stock: number }> {
    return this.inventory.setStock(dto);
  }
}
