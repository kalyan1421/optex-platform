import { Module } from '@nestjs/common';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';

/**
 * INVENTORY module — super-admin stock management.
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [AdminInventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
