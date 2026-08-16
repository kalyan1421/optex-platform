import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { AuditLogService } from './audit-log.service';
import { AdminAuditLogQueryDto } from './dto/admin-audit-log-query.dto';
import type { PaginatedAuditLog } from './dto/audit-log-entry.dto';

/**
 * Read-only audit log viewer. Mounted at `/api/admin/audit-log`. Gated by
 * `audit_log.read`, held only by Super Admin in the R1 matrix.
 */
@ApiTags('audit-log')
@ApiBearerAuth()
@RequirePermission('audit_log.read')
@Controller('admin/audit-log')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries, newest first, with optional filters' })
  @ApiOkResponse({ description: 'Paginated audit entries' })
  list(@Query() query: AdminAuditLogQueryDto): Promise<PaginatedAuditLog> {
    return this.auditLog.listForAdmin(query);
  }
}
