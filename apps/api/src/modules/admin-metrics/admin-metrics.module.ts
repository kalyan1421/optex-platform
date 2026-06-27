import { Module } from '@nestjs/common';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';

/**
 * ADMIN METRICS module — read-only dashboard KPIs and analytics reporting for
 * the super-admin panel.
 *
 * Exposes `GET /api/admin/dashboard` and `GET /api/admin/analytics`. Relies on
 * the global `SupabaseModule` for the service-role client and the global auth
 * guards for `@Roles('super_admin')` enforcement (applied at the controller
 * class level — every route is admin-only).
 *
 * Register in `app.module.ts`:
 *   import { AdminMetricsModule } from './modules/admin-metrics/admin-metrics.module';
 *   imports: [ ..., AdminMetricsModule ]
 */
@Module({
  controllers: [AdminMetricsController],
  providers: [AdminMetricsService],
  exports: [AdminMetricsService],
})
export class AdminMetricsModule {}
