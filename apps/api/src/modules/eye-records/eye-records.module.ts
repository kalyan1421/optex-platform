import { Module } from '@nestjs/common';
import { AdminEyeRecordsController } from './admin-eye-records.controller';
import { EyeRecordsController } from './eye-records.controller';
import { EyeRecordsService } from './eye-records.service';

/**
 * EYE-RECORDS module — clinical intake from the storefront's /eye-care form
 * plus the staff review surface (migration 0037).
 *
 * Customer endpoints (`/api/eye-records/*`) are JWT-scoped to the caller's own
 * `customers` row and are create/read only — a submitted record cannot be
 * edited from the storefront. The staff viewer (`/api/admin/eye-records/*`) is
 * gated by `@RequirePermission('eye_records.read'|'eye_records.write')`.
 * Relies on the global `SupabaseModule` (service-role client) and global auth
 * guards; `AuditLogService` comes from the globally-registered AuditLogModule.
 */
@Module({
  controllers: [EyeRecordsController, AdminEyeRecordsController],
  providers: [EyeRecordsService],
  exports: [EyeRecordsService],
})
export class EyeRecordsModule {}
