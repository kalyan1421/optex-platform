import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

/**
 * Global so `PermissionsGuard` (an `APP_GUARD`, registered in `AuthModule`)
 * can inject `PermissionsService` without a direct module dependency —
 * mirrors `SupabaseModule`.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
