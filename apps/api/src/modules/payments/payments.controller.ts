import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { MpesaQueryDto } from './dto/mpesa-query.dto';
import { MpesaStkPushDto } from './dto/mpesa-stk-push.dto';
import { PesapalInitiateDto } from './dto/pesapal-initiate.dto';
import { PesapalStatusQueryDto } from './dto/pesapal-status-query.dto';
import {
  MpesaStatusView,
  MpesaStkPushResult,
  PesapalInitiateResult,
  PesapalStatusView,
} from './dto/payment-views';
import { PaymentsService } from './payments.service';

/**
 * Customer-facing payment endpoints, mounted at `/api/payments`. Every route is
 * authed (global JWT guard; no `@Public()`). Order ownership and the charged
 * amount are always resolved server-side from the caller's `customers.id` and
 * the order's `total_kes` — never trusted from the client.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('mpesa/stk-push')
  @ApiOperation({ summary: 'Initiate an M-Pesa STK push for a pending order' })
  @ApiCreatedResponse({ description: 'CheckoutRequestID + customer message' })
  mpesaStkPush(
    @CurrentUser('id') authUserId: string,
    @Body() dto: MpesaStkPushDto,
  ): Promise<MpesaStkPushResult> {
    return this.payments.initiateMpesaStkPush(authUserId, dto.orderId, dto.phone);
  }

  @Post('mpesa/query')
  @ApiOperation({ summary: 'Query + reconcile an M-Pesa STK push status' })
  @ApiOkResponse({ description: 'Resolved STK push status' })
  mpesaQuery(
    @CurrentUser('id') authUserId: string,
    @Body() dto: MpesaQueryDto,
  ): Promise<MpesaStatusView> {
    return this.payments.queryMpesaStatus(authUserId, dto.checkoutRequestId);
  }

  @Post('pesapal/initiate')
  @ApiOperation({ summary: 'Initiate a Pesapal payment for a pending order' })
  @ApiCreatedResponse({ description: 'Redirect URL + OrderTrackingId' })
  pesapalInitiate(
    @CurrentUser('id') authUserId: string,
    @Body() dto: PesapalInitiateDto,
  ): Promise<PesapalInitiateResult> {
    return this.payments.initiatePesapal(authUserId, dto.orderId);
  }

  @Get('pesapal/status')
  @ApiOperation({ summary: 'Query + reconcile a Pesapal transaction status' })
  @ApiOkResponse({ description: 'Resolved Pesapal status' })
  pesapalStatus(
    @CurrentUser('id') authUserId: string,
    @Query() query: PesapalStatusQueryDto,
  ): Promise<PesapalStatusView> {
    return this.payments.queryPesapalStatus(authUserId, query.orderTrackingId);
  }
}
