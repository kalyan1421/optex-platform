import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

/**
 * Retail branch directory module. `SupabaseService` is provided globally by the
 * `@Global() SupabaseModule`, so it does not need to be imported here.
 *
 * Wired into the app by the orchestrator (added to `AppModule.imports`).
 */
@Module({
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
