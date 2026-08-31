import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators';
import { PaymentsService } from './payments.service';

/**
 * Provider webhook receivers, mounted at `/api/webhooks/...`.
 *
 * Both handlers are `@Public()` — providers carry no JWT. They NEVER throw
 * to the provider: M-Pesa always gets `{ ResultCode: 0, ResultDesc: "Accepted" }`
 * and Pesapal always gets its expected JSON ack, so the provider stops retrying
 * even if our internal processing fails — failures are logged for reconcile.
 *
 * NOTE ON AUTHENTICITY: `main.ts` captures the raw body (`rawBody: true`), but
 * neither provider signs its callbacks, so there is no signature to verify —
 * the raw body is retained for verbatim audit logging and any future signed
 * event. Safety rests instead on (a) M-Pesa idempotency keyed by
 * CheckoutRequestID, (b) Pesapal's IPN being treated as untrusted, with the
 * handler re-querying GetTransactionStatus for the real outcome rather than
 * believing the posted body, and (c) amount verification before any order is
 * credited (see PaymentsService).
 *
 * ON RATE LIMITING (audit B-04). These were `@SkipThrottle()` — the API's only
 * unbounded surface — on the reasoning that dropping a provider callback loses
 * a customer's payment confirmation, with provider IP allow-listing at the edge
 * named as the compensating control. That allowlist is not in this repository:
 * not in `docker/`, not in `.github/`, nowhere in the API (the `whitelist`
 * entries in `docker/kong.yml` are ACL consumer groups, not source-IP rules).
 * So the stated control was an assumption about an ingress nothing here
 * describes, while the Pesapal handler amplifies one-to-one — each inbound POST
 * triggers an outbound GetTransactionStatus, spending Pesapal quota rather than
 * just CPU.
 *
 * The ceiling below is deliberately far above real provider volume: a payment
 * generates a handful of callbacks, so 600/min per caller cannot drop a genuine
 * one, while still bounding a flood. It is a backstop, not a replacement for
 * the edge allowlist — put that in place too, and commit it so it is
 * reviewable. `load/webhook-flood.js` is how to size both.
 */
/**
 * Per-minute ceiling per caller on provider callbacks. Resolved per request so
 * it stays overridable — same idiom as `authRateLimit` in `auth.controller.ts`.
 */
const webhookRateLimit = (): number => Number(process.env.WEBHOOK_RATE_LIMIT ?? 600);

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly payments: PaymentsService) {}

  /** Daraja STK callback. Always acks `{ ResultCode: 0, ResultDesc: "Accepted" }`. */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: webhookRateLimit } })
  @Post('mpesa')
  async mpesaCallback(@Body() body: unknown): Promise<{ ResultCode: number; ResultDesc: string }> {
    try {
      await this.payments.handleMpesaCallback(body);
    } catch (e) {
      // Swallow — we must still ack so Daraja stops retrying. Logged for recon.
      this.logger.error(`M-Pesa callback processing failed: ${(e as Error).message}`);
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /**
   * Pesapal IPN. Accepts both POST (JSON body) and GET (query string) since
   * Pesapal can be configured for either. We trust only the OrderTrackingId,
   * then re-query GetTransactionStatus. Responds with Pesapal's expected ack.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: webhookRateLimit } })
  @Post('pesapal')
  async pesapalIpnPost(
    @Body() body: PesapalIpnBody,
    @Query() query: PesapalIpnQuery,
  ): Promise<PesapalIpnAck> {
    return this.processPesapalIpn(body, query);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: webhookRateLimit } })
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
    const orderMerchantReference = (
      body?.OrderMerchantReference ??
      query?.OrderMerchantReference ??
      ''
    ).trim();
    const orderNotificationType = (
      body?.OrderNotificationType ??
      query?.OrderNotificationType ??
      'IPNCHANGE'
    ).trim();

    // M-4 FIX: guard against empty tracking ID — Pesapal still gets its ACK
    // (to avoid retry storms) but we log and skip the DB write.
    if (!orderTrackingId) {
      this.logger.warn('Pesapal IPN received with missing OrderTrackingId — skipping');
      return { orderNotificationType, orderTrackingId: '', orderMerchantReference, status: 200 };
    }

    try {
      await this.payments.handlePesapalIpn(orderTrackingId);
    } catch (e) {
      this.logger.error(`Pesapal IPN processing failed: ${(e as Error).message}`);
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
