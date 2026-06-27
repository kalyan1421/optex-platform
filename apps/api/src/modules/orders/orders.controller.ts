import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import {
  CheckoutResultView,
  OrderDetailView,
  OrderSummaryView,
  OrderTrackingView,
  PaginatedOrders,
} from './dto/order-views';
import { OrdersService } from './orders.service';

/**
 * Customer-facing checkout + order endpoints. Every route requires a valid JWT
 * (global auth guard; no `@Public()`). Orders are always scoped to the caller's
 * `customers.id`, resolved from the JWT — no order or customer id is ever
 * trusted from the client for ownership. Mounted under the global `api` prefix.
 */
@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Place an order from the caller\'s cart (server-side repricing)',
  })
  @ApiCreatedResponse({
    description: 'The created order plus a payment instruction block',
  })
  checkout(
    @CurrentUser('id') authUserId: string,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResultView> {
    return this.orders.checkout(authUserId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: "List the caller's order history (paginated)" })
  @ApiOkResponse({ description: 'Paginated order summaries, newest first' })
  listMyOrders(
    @CurrentUser('id') authUserId: string,
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedOrders<OrderSummaryView>> {
    return this.orders.listMyOrders(authUserId, query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: "Get one of the caller's orders in full" })
  @ApiOkResponse({ description: 'Full order detail with line items' })
  getOrder(
    @CurrentUser('id') authUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderDetailView> {
    return this.orders.getOrderDetail(authUserId, id);
  }

  @Get('orders/:id/tracking')
  @ApiOperation({
    summary: 'Status timeline for one of the caller\'s orders',
  })
  @ApiOkResponse({
    description:
      'Received → Processing → Dispatched → Delivered stage timeline',
  })
  getTracking(
    @CurrentUser('id') authUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<OrderTrackingView> {
    return this.orders.getTracking(authUserId, id);
  }
}
