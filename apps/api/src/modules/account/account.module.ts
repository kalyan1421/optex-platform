import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { AccountService } from './account.service';

/**
 * ACCOUNT ("me") module — authenticated customer self-service profile.
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [MeController],
  providers: [AccountService],
})
export class AccountModule {}
