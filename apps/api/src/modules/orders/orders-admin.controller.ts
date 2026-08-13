import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../auth/decorators';
import { AdminListOrdersQueryDto } from './dto/admin-list-orders-query.dto';
import { AdminOrderStatusDto } from './dto/admin-order-status.dto';
import { AdminOrderSummaryView, OrderDetailView, PaginatedOrders } from './dto/order-views';
import { OrdersService } from './orders.service';
import { CancellationService } from './cancellation.service';
import { ApproveCancellationDto, DeclineCancellationDto } from './dto/decide-cancellation.dto';

/**
 * Super-admin order management. Mounted at `/api/admin`. Every route is gated by
 * `@Roles('super_admin')` on top of the global JWT guard, so these handlers run
 * with full visibility across all customers' orders.
 */
@ApiTags('orders')
@Roles('super_admin')
@Controller('admin')
export class OrdersAdminController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cancellation: CancellationService,
  ) {}

  @Get('orders')
  @ApiOperation({
    summary: 'List all orders with status / payment filters + pagination',
  })
  @ApiOkResponse({ description: 'Paginated order summaries with customer info' })
  listOrders(
    @Query() query: AdminListOrdersQueryDto,
  ): Promise<PaginatedOrders<AdminOrderSummaryView>> {
    return this.orders.adminListOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Full detail for any order (items, shipping, totals)' })
  @ApiOkResponse({ description: 'The order detail' })
  getOrder(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderDetailView> {
    return this.orders.adminOrderDetail(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary: 'Advance an order through the fulfilment workflow',
  })
  @ApiOkResponse({ description: 'The updated order detail' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminOrderStatusDto,
  ): Promise<OrderDetailView> {
    return this.orders.adminUpdateStatus(id, dto);
  }

  // ─── Cancellation requests (SPEC-06 R3) ─────────────────────────────────

  @Get('cancellations')
  @ApiOperation({ summary: 'Cancellation requests, newest first, optionally by status' })
  @ApiOkResponse({ description: 'Requests with order, customer and payment context' })
  listCancellations(@Query('status') status?: string) {
    return this.cancellation.listForAdmin(status);
  }

  @Get('cancellations/pending-count')
  @ApiOperation({ summary: 'How many requests are awaiting a decision' })
  @ApiOkResponse({ description: 'The count, for the admin nav badge' })
  async pendingCancellations(): Promise<{ count: number }> {
    return { count: await this.cancellation.pendingCount() };
  }

  @Patch('cancellations/:id/approve')
  @ApiOperation({ summary: 'Approve a request — cancels the order' })
  @ApiOkResponse({ description: 'The decided request' })
  approveCancellation(
    @CurrentUser('id') adminUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveCancellationDto,
  ) {
    return this.cancellation.approve(adminUserId, id, dto.acknowledgePaid ?? false);
  }

  @Patch('cancellations/:id/decline')
  @ApiOperation({ summary: 'Decline a request — the order keeps its status' })
  @ApiOkResponse({ description: 'The decided request' })
  declineCancellation(
    @CurrentUser('id') adminUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeclineCancellationDto,
  ) {
    return this.cancellation.decline(adminUserId, id, dto.reason);
  }
}
