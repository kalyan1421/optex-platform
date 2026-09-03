import { Global, Module } from '@nestjs/common';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { CustomerNotificationsService } from './customer-notifications.service';

/**
 * CUSTOMER NOTIFICATIONS module — the storefront's in-app feed (orders,
 * appointments, offers), backed by `customer_notifications` (migration
 * 0035). Distinct from the existing `NotificationsModule`, which is
 * SMS/email dispatch, not a readable feed.
 *
 * Marked `@Global()`, mirroring `NotificationsModule`'s own convention
 * exactly: `CustomerNotificationsService` is exported so `OrdersModule`,
 * `AppointmentsModule`, `PromotionsModule`, and `CronModule` can call
 * `notify()`/`notifyAllCustomers()` at the same points they already send
 * an SMS/email, with no local import needed in any of them. Relies on the
 * global `SupabaseModule` (service-role client) and global auth guards.
 */
@Global()
@Module({
  controllers: [CustomerNotificationsController],
  providers: [CustomerNotificationsService],
  exports: [CustomerNotificationsService],
})
export class CustomerNotificationsModule {}
