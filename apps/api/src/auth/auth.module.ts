import { Global, Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

/**
 * Provides the auth/authorization guards. The guards are registered globally
 * as `APP_GUARD`s in `AppModule`; this module makes them injectable.
 */
@Global()
@Module({
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
