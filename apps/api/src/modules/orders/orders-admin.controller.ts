import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { AdminListOrdersQueryDto } from './dto/admin-list-orders-query.dto';
import { AdminOrderStatusDto } from './dto/admin-order-status.dto';
import { AdminOrderSummaryView, OrderDetailView, PaginatedOrders } from './dto/order-views';
import { OrdersService } from './orders.service';

/**
 * Super-admin order management. Mounted at `/api/admin`. Every route is gated by
 * `@Roles('super_admin')` on top of the global JWT guard, so these handlers run
 * with full visibility across all customers' orders.
 */
@ApiTags('orders')
@Roles('super_admin')
@Controller('admin')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

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
}
