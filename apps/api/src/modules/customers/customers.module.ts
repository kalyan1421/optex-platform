import { Module } from '@nestjs/common';
import { AdminCustomersController } from './admin-customers.controller';
import { CustomersService } from './customers.service';

/**
 * CUSTOMERS module — super-admin customer directory.
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [AdminCustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
