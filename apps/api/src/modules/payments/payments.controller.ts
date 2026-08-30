import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
 * Per-minute cap on payment INITIATION, resolved per request so the value can
 * be overridden at runtime — the same idiom, and for the same reason, as
 * `authRateLimit` in `auth.controller.ts`.
 *
 * Audit A-03. These two endpoints inherited the global 300/min bucket, which is
 * sized for browsing a catalogue, not for reaching a payment provider. An STK
 * push puts a real PIN prompt on a real handset and costs a Daraja call; five
 * a minute is well above what paying for an order takes (initiate, mistype,
 * retry) and far below what abusing it needs.
 */
const paymentInitRateLimit = (): number => Number(process.env.PAYMENT_INIT_RATE_LIMIT ?? 5);

/**
 * Customer-facing payment endpoints, mounted at `/api/payments`. Every route is
 * authed (global JWT guard; no `@Public()`). Order ownership and the charged
 * amount are always resolved server-side from the caller's `customers.id` and
 * the order's `total_kes` — never trusted from the client.
 *
 * The two INITIATION routes additionally carry a tight `@Throttle` override
 * (audit A-03): they are the only customer-reachable endpoints that cost money
 * and reach a third party, which is exactly the property the credential
 * endpoints are throttled for.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Throttle({ default: { ttl: 60_000, limit: paymentInitRateLimit } })
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

  @Throttle({ default: { ttl: 60_000, limit: paymentInitRateLimit } })
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
