import { Global, Module } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * Shared cross-cutting providers. The exception filter is registered globally
 * as an `APP_FILTER` in `AppModule`; exporting it here keeps it injectable and
 * available for explicit `@UseFilters()` usage if a module ever needs it.
 */
@Global()
@Module({
  providers: [AllExceptionsFilter],
  exports: [AllExceptionsFilter],
})
export class CommonModule {}
