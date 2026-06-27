import { Module } from '@nestjs/common';
import { OrdersAdminController } from './orders-admin.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * ORDERS module — checkout + order history + admin order management.
 *
 * Customer routes (`POST /checkout`, `GET /orders`, `GET /orders/:id`,
 * `GET /orders/:id/tracking`) are authed and scoped to the caller's
 * `customers.id`. Admin routes (`GET /admin/orders`,
 * `PATCH /admin/orders/:id/status`) require `super_admin`.
 *
 * Checkout recomputes ALL money server-side from `products` + `promo_codes`
 * (never trusting client amounts — S-1 fix), snapshots `unit_price_kes` per
 * line, relies on the DB DEFAULT `generate_order_number()` (migration 0006) for
 * unique order numbers, and clears the cart in a single delete with compensating
 * rollback of the order if the items insert fails (best-effort substitute for a
 * true DB transaction — see OrdersService ATOMICITY NOTE).
 *
 * Depends on the global `SupabaseModule` (service-role client) and the global
 * `NotificationsModule` (injects `EmailService` + `SmsService` for best-effort
 * order confirmations / status updates). `OrdersService` is exported so siblings
 * (e.g. a future Payments module) can confirm orders.
 */
@Module({
  controllers: [OrdersController, OrdersAdminController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
