import { Module } from '@nestjs/common';
import { DeviceTokensRepository } from './device-tokens.repository';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { FcmService } from './fcm.service';
import { PushService } from './push.service';

/**
 * PUSH module (SPEC-11 B-1) — mobile push notifications over FCM.
 *
 * `PushService` is exported for `CustomerNotificationsService`, which calls it at
 * the same points it writes a notification-feed row, so an order, appointment or
 * offer event reaches a phone without any of those modules knowing push exists.
 * Relies on the global `SupabaseModule` and `NotificationsModule` (for the
 * delivery log), and on the global auth guard.
 */
@Module({
  controllers: [DevicesController],
  providers: [DeviceTokensRepository, DevicesService, FcmService, PushService],
  exports: [PushService],
})
export class PushModule {}
