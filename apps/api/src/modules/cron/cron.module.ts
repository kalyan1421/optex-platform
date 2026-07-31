import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { AppointmentRemindersJob } from './appointment-reminders.job';
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
 *
 * IMPORTS `PaymentsModule` (NOT global) to inject `PaymentsService` +
 * `MpesaService`. `SupabaseService` (global SupabaseModule) and `SmsService`
 * (global NotificationsModule) need no local import.
 */
@Module({
  imports: [PaymentsModule],
  providers: [AppointmentRemindersJob, MpesaPollingJob],
})
export class CronModule {}
