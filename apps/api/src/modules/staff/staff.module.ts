import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/**
 * STAFF module — super-admin staff directory (CR-01 R1 1c).
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
