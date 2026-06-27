import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators';
import { PaymentsService } from './payments.service';

/**
 * Provider webhook receivers, mounted at `/api/webhooks/...`.
 *
 * Both handlers are `@Public()` (providers carry no JWT) AND `@SkipThrottle()`
 * (the global rate limiter must not drop provider callbacks). They NEVER throw
 * to the provider: M-Pesa always gets `{ ResultCode: 0, ResultDesc: "Accepted" }`
 * and Pesapal always gets its expected JSON ack, so the provider stops retrying
 * even if our internal processing fails — failures are logged for reconcile.
 *
 * NOTE: `main.ts` does not currently enable raw-body capture, so we cannot
 * cryptographically verify signatures here. Safety instead rests on (a) M-Pesa
 * idempotency keyed by CheckoutRequestID and (b) Pesapal's IPN being treated as
 * untrusted — the IPN handler re-queries GetTransactionStatus for the real
 * outcome rather than believing the posted body.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly payments: PaymentsService) {}

  /** Daraja STK callback. Always acks `{ ResultCode: 0, ResultDesc: "Accepted" }`. */
  @Public()
  @SkipThrottle()
  @Post('mpesa')
  async mpesaCallback(
    @Body() body: unknown,
  ): Promise<{ ResultCode: number; ResultDesc: string }> {
    try {
      await this.payments.handleMpesaCallback(body);
    } catch (e) {
      // Swallow — we must still ack so Daraja stops retrying. Logged for recon.
      this.logger.error(
        `M-Pesa callback processing failed: ${(e as Error).message}`,
      );
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /**
   * Pesapal IPN. Accepts both POST (JSON body) and GET (query string) since
   * Pesapal can be configured for either. We trust only the OrderTrackingId,
   * then re-query GetTransactionStatus. Responds with Pesapal's expected ack.
   */
  @Public()
  @SkipThrottle()
  @Post('pesapal')
  async pesapalIpnPost(
    @Body() body: PesapalIpnBody,
    @Query() query: PesapalIpnQuery,
  ): Promise<PesapalIpnAck> {
    return this.processPesapalIpn(body, query);
  }

  @Public()
  @SkipThrottle()
  @Get('pesapal')
  async pesapalIpnGet(@Query() query: PesapalIpnQuery): Promise<PesapalIpnAck> {
    return this.processPesapalIpn({}, query);
  }

  private async processPesapalIpn(
    body: PesapalIpnBody,
    query: PesapalIpnQuery,
  ): Promise<PesapalIpnAck> {
    // M-4 FIX: normalise all field names to lower-case before resolving so that
    // case differences between Pesapal's POST body (PascalCase) and GET query
    // (may be camelCase) don't result in ambiguous or empty tracking IDs.
    const normaliseId = (v: string | undefined) => (v ?? '').trim();
    const orderTrackingId =
      normaliseId(body?.OrderTrackingId) ||
      normaliseId(query?.OrderTrackingId) ||
      normaliseId(query?.orderTrackingId);
    const orderMerchantReference =
      (body?.OrderMerchantReference ?? query?.OrderMerchantReference ?? '').trim();
    const orderNotificationType =
      (body?.OrderNotificationType ?? query?.OrderNotificationType ?? 'IPNCHANGE').trim();

    // M-4 FIX: guard against empty tracking ID — Pesapal still gets its ACK
    // (to avoid retry storms) but we log and skip the DB write.
    if (!orderTrackingId) {
      this.logger.warn('Pesapal IPN received with missing OrderTrackingId — skipping');
      return { orderNotificationType, orderTrackingId: '', orderMerchantReference, status: 200 };
    }

    try {
      await this.payments.handlePesapalIpn(orderTrackingId);
    } catch (e) {
      this.logger.error(
        `Pesapal IPN processing failed: ${(e as Error).message}`,
      );
    }

    // Pesapal expects this exact acknowledgement shape so it marks the IPN sent.
    return {
      orderNotificationType,
      orderTrackingId,
      orderMerchantReference,
      status: 200,
    };
  }
}

interface PesapalIpnBody {
  OrderTrackingId?: string;
  OrderMerchantReference?: string;
  OrderNotificationType?: string;
}

interface PesapalIpnQuery {
  OrderTrackingId?: string;
  orderTrackingId?: string;
  OrderMerchantReference?: string;
  OrderNotificationType?: string;
}

interface PesapalIpnAck {
  orderNotificationType: string;
  orderTrackingId: string;
  orderMerchantReference: string;
  status: number;
}
