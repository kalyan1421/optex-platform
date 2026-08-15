import { Global, Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { EmailService } from './email.service';
import { NotificationLogService } from './notification-log.service';
import { SmsService } from './sms.service';

/**
 * Cross-cutting notifications module.
 *
 * Marked `@Global()` and exports `SmsService` + `EmailService` so other modules
 * (orders / payments / appointments) can inject them without a local import.
 * Also exposes the public contact-form endpoint at `/api/contact`.
 *
 * `NotificationLogService` is exported too — not for sending, which still goes
 * through the two channel services, but so the retry sweep in CronModule can
 * pull due rows (F-06).
 */
@Global()
@Module({
  controllers: [ContactController],
  providers: [SmsService, EmailService, NotificationLogService],
  exports: [SmsService, EmailService, NotificationLogService],
})
export class NotificationsModule {}
