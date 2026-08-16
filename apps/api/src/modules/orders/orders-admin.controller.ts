import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission, CurrentUser } from '../../auth/decorators';
import { AdminListOrdersQueryDto } from './dto/admin-list-orders-query.dto';
import { AdminOrderStatusDto } from './dto/admin-order-status.dto';
import { AdminOrderSummaryView, OrderDetailView, PaginatedOrders } from './dto/order-views';
import { OrdersService } from './orders.service';
import { CancellationService } from './cancellation.service';
import {
  AdminDirectCancelDto,
  ApproveCancellationDto,
  DeclineCancellationDto,
} from './dto/decide-cancellation.dto';

/**
 * Super-admin order management. Mounted at `/api/admin`. Gated by `orders.*`
 * and `cancellations.decide` (`@RequirePermission`) on top of the global JWT
 * guard. Branch-scoping `listOrders`/`getOrder` to a Branch Manager/Staff's
 * own branch is R1 sub-phase 1b, not yet done here — `orders.branch_id` is
 * nullable and currently unfiltered.
 */
@ApiTags('orders')
@Controller('admin')
export class OrdersAdminController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cancellation: CancellationService,
  ) {}

  @RequirePermission('orders.read')
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

  @RequirePermission('orders.read')
  @Get('orders/:id')
  @ApiOperation({ summary: 'Full detail for any order (items, shipping, totals)' })
  @ApiOkResponse({ description: 'The order detail' })
  getOrder(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderDetailView> {
    return this.orders.adminOrderDetail(id);
  }

  @RequirePermission('orders.write')
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

  @RequirePermission('orders.cancel')
  @Patch('orders/:id/cancel')
  @ApiOperation({
    summary: 'Cancel an order directly, with no customer request behind it — the phone-call path',
  })
  @ApiOkResponse({ description: 'The cancelled order' })
  directCancel(
    @CurrentUser('id') adminUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminDirectCancelDto,
  ) {
    return this.cancellation.adminCancel(adminUserId, id, dto.reason, dto.acknowledgePaid ?? false);
  }

  // ─── Cancellation requests (SPEC-06 R3) ─────────────────────────────────

  @RequirePermission('cancellations.decide')
  @Get('cancellations')
  @ApiOperation({ summary: 'Cancellation requests, newest first, optionally by status' })
  @ApiOkResponse({ description: 'Requests with order, customer and payment context' })
  listCancellations(@Query('status') status?: string) {
    return this.cancellation.listForAdmin(status);
  }

  @RequirePermission('cancellations.decide')
  @Get('cancellations/pending-count')
  @ApiOperation({ summary: 'How many requests are awaiting a decision' })
  @ApiOkResponse({ description: 'The count, for the admin nav badge' })
  async pendingCancellations(): Promise<{ count: number }> {
    return { count: await this.cancellation.pendingCount() };
  }

  @RequirePermission('cancellations.decide')
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

  @RequirePermission('cancellations.decide')
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
