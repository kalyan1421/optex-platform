import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AdminAppointmentsController } from './admin-appointments.controller';
import { AppointmentsService } from './appointments.service';

/**
 * APPOINTMENTS module — basic SOW booking flow (eye test / frame fitting /
 * consultation). No doctor concept (that is a future CR-01 module).
 *
 * Public slot availability + customer booking/cancel/reschedule, plus
 * super-admin management.
 *
 * `SupabaseModule` is global (provides `SupabaseService`) and the
 * `NotificationsModule` is `@Global()` (provides `SmsService`), so both are
 * injectable here without importing those modules. Wired into `AppModule` by
 * the orchestrator.
 */
@Module({
  controllers: [AppointmentsController, AdminAppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
