import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AppointmentRemindersJob } from './appointment-reminders.job';
import { CancellationAutoDeclineJob } from './cancellation-auto-decline.job';
import { MpesaPollingJob } from './mpesa-polling.job';

/**
 * CRON module — unattended scheduled jobs.
 *
 * `ScheduleModule.forRoot()` is wired once in `AppModule`, so the `@Cron`
 * decorators on the job providers here are discovered automatically; this module
 * only needs to register the providers and their dependencies.
 *
 * Jobs:
 *  - {@link AppointmentRemindersJob} — every 15 min: SMS reminders for bookings
 *    due in ~24h / ~1h (uses the global `SmsService`).
 *  - {@link MpesaPollingJob} — every 2 min: re-queries pending M-Pesa STK pushes
 *    and reconciles them via `PaymentsService.adminReconcile` (fixes P-4 — lost
 *    Daraja callbacks).
 *  - {@link CancellationAutoDeclineJob} — every 15 min: auto-declines
 *    cancellation requests nobody answered in time (SPEC-06 R9), via
 *    `CancellationService.autoDeclineStale`.
 *
 * IMPORTS `PaymentsModule` and `OrdersModule` (neither global) to inject
 * `PaymentsService` + `MpesaService` and `CancellationService` respectively.
 * `SupabaseService` (global SupabaseModule) and `SmsService` (global
 * NotificationsModule) need no local import.
 */
@Module({
  imports: [PaymentsModule, OrdersModule],
  providers: [AppointmentRemindersJob, MpesaPollingJob, CancellationAutoDeclineJob],
})
export class CronModule {}
