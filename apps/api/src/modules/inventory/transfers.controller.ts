import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { TransfersService } from './transfers.service';
import { DispatchTransferDto, ReceiveTransferDto, TransferDto } from './dto/transfer.dto';

/**
 * Inter-branch transfers — R2 sub-phase 2b. Mounted at `/api/admin/transfers`
 * (global prefix applied in `main.ts`). Every route requires
 * `inventory.transfer`, held by `inventory_manager` and `super_admin`
 * (migration 0026).
 */
@ApiTags('transfers')
@ApiBearerAuth()
@Controller('admin/transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @RequirePermission('inventory.transfer')
  @Get()
  @ApiOperation({ summary: 'List transfers' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'in_transit', 'received', 'cancelled'] })
  @ApiQuery({ name: 'fromBranchId', required: false })
  @ApiQuery({ name: 'toBranchId', required: false })
  @ApiOkResponse({ type: [TransferDto] })
  list(
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
  ): Promise<TransferDto[]> {
    return this.transfers.findAllForAdmin({ status, fromBranchId, toBranchId });
  }

  @RequirePermission('inventory.transfer')
  @Get(':id')
  @ApiOperation({ summary: 'Get a transfer with its lines' })
  @ApiOkResponse({ type: TransferDto })
  @ApiNotFoundResponse({ description: 'Transfer not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TransferDto> {
    return this.transfers.findById(id);
  }

  @RequirePermission('inventory.transfer')
  @Post()
  @ApiOperation({ summary: 'Dispatch a transfer — releases the given serials from the origin branch into transit' })
  @ApiCreatedResponse({ type: TransferDto })
  dispatch(@Body() dto: DispatchTransferDto, @CurrentUser() actorUser: AuthUser): Promise<TransferDto> {
    return this.transfers.dispatch(dto, actorUser);
  }

  @RequirePermission('inventory.transfer')
  @Patch(':id/receive')
  @ApiOperation({
    summary: 'Resolve a transfer\'s in-transit lines as arrived or lost — callable more than once for a partial receipt',
  })
  @ApiOkResponse({ type: TransferDto })
  @ApiNotFoundResponse({ description: 'Transfer not found' })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<TransferDto> {
    return this.transfers.receive(id, dto, actorUser);
  }
}
