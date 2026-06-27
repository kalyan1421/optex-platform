import { Global, Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

/**
 * Cross-cutting notifications module.
 *
 * Marked `@Global()` and exports `SmsService` + `EmailService` so future
 * modules (orders / payments / appointments) can inject them without a local
 * import. Also exposes the public contact-form endpoint at `/api/contact`.
 */
@Global()
@Module({
  controllers: [ContactController],
  providers: [SmsService, EmailService],
  exports: [SmsService, EmailService],
})
export class NotificationsModule {}
