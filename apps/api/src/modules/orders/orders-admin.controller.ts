import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission, CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
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
 * guard. `listOrders`/`getOrder`/`updateStatus`/`directCancel` are
 * branch-scoped server-side for Branch Manager/Staff (R1 1b) — see
 * `orders.service.ts` and `cancellation.service.ts`.
 *
 * KNOWN GAP: the cancellation-REQUEST workflow below (`listCancellations`,
 * `pendingCancellations`, `approveCancellation`, `declineCancellation`) is
 * NOT branch-scoped — a Branch Manager holding `cancellations.decide` can
 * currently see and decide any branch's pending requests. Left for a
 * follow-up rather than folded into this pass: `order_cancellation_requests`
 * isn't a resource `orders.service.ts` or `cancellation.service.ts`'s
 * `adminCancel` already had a branch-scoping precedent for, and warrants its
 * own change rather than being rushed alongside this one.
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
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedOrders<AdminOrderSummaryView>> {
    return this.orders.adminListOrders(query, user);
  }

  @RequirePermission('orders.read')
  @Get('orders/:id')
  @ApiOperation({ summary: 'Full detail for any order (items, shipping, totals)' })
  @ApiOkResponse({ description: 'The order detail' })
  getOrder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderDetailView> {
    return this.orders.adminOrderDetail(id, user);
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
    @CurrentUser() user: AuthUser,
  ): Promise<OrderDetailView> {
    return this.orders.adminUpdateStatus(id, dto, user);
  }

  @RequirePermission('orders.cancel')
  @Patch('orders/:id/cancel')
  @ApiOperation({
    summary: 'Cancel an order directly, with no customer request behind it — the phone-call path',
  })
  @ApiOkResponse({ description: 'The cancelled order' })
  directCancel(
    @CurrentUser('id') adminUserId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminDirectCancelDto,
  ) {
    return this.cancellation.adminCancel(
      adminUserId,
      id,
      user,
      dto.reason,
      dto.acknowledgePaid ?? false,
    );
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
