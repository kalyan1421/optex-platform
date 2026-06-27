import { Module } from '@nestjs/common';
import { AdminPrescriptionsController } from './admin-prescriptions.controller';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';

/**
 * PRESCRIPTIONS module — customer prescription uploads + admin viewer.
 *
 * Customer endpoints (`/api/prescriptions/*`) are JWT-scoped to the caller's
 * own `customers` row; the admin viewer (`/api/admin/prescriptions/*`) is
 * gated by `@Roles('super_admin')`. Files live in the PRIVATE `prescriptions`
 * storage bucket and are only ever exposed via 60s signed URLs. Relies on the
 * global `SupabaseModule` (service-role client) and global auth guards.
 */
@Module({
  controllers: [PrescriptionsController, AdminPrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
