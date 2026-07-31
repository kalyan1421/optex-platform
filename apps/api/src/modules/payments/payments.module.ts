import { Module } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { PesapalService } from './pesapal.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsAdminController } from './payments-admin.controller';
import { WebhooksController } from './webhooks.controller';

/**
 * PAYMENTS module — M-Pesa (Daraja STK push) + Pesapal (v3) for the storefront.
 *
 * Customer routes (`/api/payments/...`) are authed and scoped to the caller's
 * order ownership. Webhook routes (`/api/webhooks/mpesa`, `/api/webhooks/pesapal`)
 * are `@Public()` + `@SkipThrottle()` (providers carry no JWT) and are
 * idempotent. Admin routes (`/api/admin/payments`, `.../:id/reconcile`) require
 * `super_admin`.
 *
 * Depends on the global `SupabaseModule` (service-role client — webhooks write
 * without a user JWT) and the global `NotificationsModule` (`EmailService` +
 * `SmsService` for best-effort payment confirmations).
 *
 * MISSING-CREDS: provider clients are inert at construction; a missing key
 * makes only the relevant ENDPOINT throw `ServiceUnavailableException` at call
 * time. The app boots + serves other modules without payment creds.
 *
 * IDEMPOTENCY: anchored on the transaction tables' unique keys
 * (`mpesa_transactions.mpesa_ref` holds the CheckoutRequestID until the real
 * receipt arrives; `pesapal_transactions.pesapal_order_id` = OrderTrackingId) +
 * a guarded `orders` update (`payment_status != 'paid'`) so an order is credited
 * at most once.
 *
 * EXPORTS `MpesaService`, `PesapalService`, and `PaymentsService` so the
 * upcoming Cron module can reuse the Daraja/Pesapal clients for status polling.
 */
@Module({
  controllers: [PaymentsController, WebhooksController, PaymentsAdminController],
  providers: [PaymentsService, MpesaService, PesapalService],
  exports: [PaymentsService, MpesaService, PesapalService],
})
export class PaymentsModule {}
