import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AdjustmentsService } from './adjustments.service';
import { AdjustmentDto, AdjustmentReasonDto, CreateAdjustmentDto } from './dto/adjustment.dto';

/**
 * Stock adjustments — R2 sub-phase 2c. Mounted at `/api/admin/adjustments`
 * (global prefix applied in `main.ts`). Every route requires
 * `inventory.adjust`, held by `inventory_manager` and `super_admin`
 * (migration 0026).
 */
@ApiTags('adjustments')
@ApiBearerAuth()
@Controller('admin/adjustments')
export class AdjustmentsController {
  constructor(private readonly adjustments: AdjustmentsService) {}

  @RequirePermission('inventory.adjust')
  @Get('reasons')
  @ApiOperation({ summary: 'List adjustment reason codes' })
  @ApiOkResponse({ type: [AdjustmentReasonDto] })
  listReasons(): Promise<{ id: string; description: string }[]> {
    return this.adjustments.listReasons();
  }

  @RequirePermission('inventory.adjust')
  @Get()
  @ApiOperation({ summary: 'List adjustments' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiOkResponse({ type: [AdjustmentDto] })
  list(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<AdjustmentDto[]> {
    return this.adjustments.findAllForAdmin({ branchId }, user);
  }

  @RequirePermission('inventory.adjust')
  @Get(':id')
  @ApiOperation({ summary: 'Get an adjustment with its lines' })
  @ApiOkResponse({ type: AdjustmentDto })
  @ApiNotFoundResponse({ description: 'Adjustment not found' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<AdjustmentDto> {
    return this.adjustments.findById(id, user);
  }

  @RequirePermission('inventory.adjust')
  @Post()
  @ApiOperation({ summary: 'Post an adjustment — write off existing serials and/or log newly-found stock' })
  @ApiCreatedResponse({ type: AdjustmentDto })
  create(@Body() dto: CreateAdjustmentDto, @CurrentUser() actorUser: AuthUser): Promise<AdjustmentDto> {
    return this.adjustments.create(dto, actorUser);
  }
}
