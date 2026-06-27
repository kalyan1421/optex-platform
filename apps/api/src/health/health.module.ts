import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * Health/liveness endpoints. TerminusModule is imported so this module can be
 * extended with readiness checks (DB ping, Supabase reachability) later without
 * restructuring.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
