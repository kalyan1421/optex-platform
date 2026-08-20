import { Module } from '@nestjs/common';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryService } from './inventory.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { GrnController } from './grn.controller';
import { GrnService } from './grn.service';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { AdjustmentsController } from './adjustments.controller';
import { AdjustmentsService } from './adjustments.service';
import { StockCountsController } from './stock-counts.controller';
import { StockCountsService } from './stock-counts.service';
import { LedgerService } from './ledger.service';

/**
 * INVENTORY module — stock reads plus the R2 ledger's receiving (suppliers,
 * GRN), inter-branch transfer, adjustment, and physical-count flows.
 * Sibling-service shape mirrors `OrdersModule` (`OrdersService` +
 * `CancellationService`): one module, several services, each controller
 * individually `@RequirePermission`-gated per route rather than one blanket
 * controller guard. Reporting + the admin UI replacement land in R2
 * sub-phase 2e.
 *
 * `SupabaseModule` is global, so `SupabaseService` is injectable here without
 * importing it. Wired into `AppModule` by the orchestrator.
 */
@Module({
  controllers: [
    AdminInventoryController,
    SuppliersController,
    GrnController,
    TransfersController,
    AdjustmentsController,
    StockCountsController,
  ],
  providers: [
    InventoryService,
    SuppliersService,
    GrnService,
    TransfersService,
    AdjustmentsService,
    StockCountsService,
    LedgerService,
  ],
})
export class InventoryModule {}
