import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AppointmentRemindersJob } from './appointment-reminders.job';
import { CancellationAutoDeclineJob } from './cancellation-auto-decline.job';
import { CronLeaseService } from './cron-lease.service';
import { MpesaPollingJob } from './mpesa-polling.job';
import { NotificationRetryJob } from './notification-retry.job';

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
 *  - {@link NotificationRetryJob} — every 5 min: re-sends notifications that
 *    failed, with exponential backoff (audit F-06).
 *
 * SINGLE-RUNNER (audit F-05): every job above takes a {@link CronLeaseService}
 * lease before doing any work. `@nestjs/schedule` fires on every process, so
 * without this a second replica meant double Daraja polling, duplicate reminder
 * SMS, and two auto-decline sweeps racing the same rows — which made scaling
 * out impossible, and scaling out is the remedy for the rate-limit pressure in
 * F-01.
 *
 * IMPORTS `PaymentsModule` and `OrdersModule` (neither global) to inject
 * `PaymentsService` + `MpesaService` and `CancellationService` respectively.
 * `SupabaseService` (global SupabaseModule) and the notification services
 * (global NotificationsModule) need no local import.
 */
@Module({
  imports: [PaymentsModule, OrdersModule],
  providers: [
    CronLeaseService,
    AppointmentRemindersJob,
    MpesaPollingJob,
    CancellationAutoDeclineJob,
    NotificationRetryJob,
  ],
})
export class CronModule {}
