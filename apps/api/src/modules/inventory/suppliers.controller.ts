import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { SuppliersService, type SupplierRow } from './suppliers.service';
import { CreateSupplierDto, SupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

/**
 * Supplier directory (R2). Mounted at `/api/admin/suppliers` (global prefix
 * applied in `main.ts`). Every route requires `suppliers.manage`, held by
 * `inventory_manager` and `super_admin` (migration 0026).
 */
@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('admin/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @RequirePermission('suppliers.manage')
  @Get()
  @ApiOperation({ summary: 'List suppliers' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'When true, excludes deactivated suppliers.',
  })
  @ApiOkResponse({ type: [SupplierDto], description: 'Suppliers' })
  list(@Query('activeOnly') activeOnly?: string): Promise<SupplierRow[]> {
    return this.suppliers.findAllForAdmin(activeOnly === 'true');
  }

  @RequirePermission('suppliers.manage')
  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier by id' })
  @ApiOkResponse({ type: SupplierDto })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierRow> {
    return this.suppliers.findById(id);
  }

  @RequirePermission('suppliers.manage')
  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  @ApiCreatedResponse({ type: SupplierDto })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() actorUser: AuthUser): Promise<SupplierRow> {
    return this.suppliers.create(dto, actorUser);
  }

  @RequirePermission('suppliers.manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier, or deactivate it via is_active' })
  @ApiOkResponse({ type: SupplierDto })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<SupplierRow> {
    return this.suppliers.update(id, dto, actorUser);
  }
}
