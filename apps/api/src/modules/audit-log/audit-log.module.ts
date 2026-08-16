import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

/**
 * AUDIT LOG module — CR-01 R1 1d.
 *
 * `@Global()` so every other module's service can inject `AuditLogService`
 * to call `record()` at its own mutation sites, without each of those
 * modules taking an explicit dependency on this one — mirrors
 * `PermissionsModule`.
 */
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
