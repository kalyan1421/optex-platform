import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import { EyeRecordQueryDto } from './dto/eye-record-query.dto';
import { UpdateEyeRecordStatusDto } from './dto/update-eye-record-status.dto';
import { AdminEyeRecordRow, EyeRecordsService } from './eye-records.service';

/**
 * Staff eye-record viewer. Mounted at `/api/admin/eye-records` (global `api`
 * prefix). Gated by `eye_records.read`/`eye_records.write` from migration 0037.
 *
 * Unlike `/admin/prescriptions` — which stays Super-Admin-only because
 * prescription *files* have no branch scope — intake records are read by the
 * branch staff who actually run the eye test, so 0037 grants read to
 * branch_staff and branch_manager, and write to branch_manager.
 *
 * Branch-scoped since 0038: a Branch Manager or Branch Staff sees only intake
 * taken at their own branch. The scope reads `eye_records.branch_id`, stamped
 * server-side from the linked appointment at insert — a client-supplied branch
 * id in the query string is ignored. Records with no appointment behind them
 * carry no branch and so appear only to an unscoped Super Admin.
 */
@ApiTags('admin-eye-records')
@ApiBearerAuth()
@Controller('admin/eye-records')
export class AdminEyeRecordsController {
  constructor(private readonly eyeRecords: EyeRecordsService) {}

  @RequirePermission('eye_records.read')
  @Get()
  @ApiOperation({ summary: 'List eye records (optionally filtered by customer/status)' })
  @ApiOkResponse({ description: 'Eye records, newest first' })
  list(
    @Query() query: EyeRecordQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AdminEyeRecordRow[]> {
    return this.eyeRecords.listAll(query, user);
  }

  @RequirePermission('eye_records.read')
  @Get(':id')
  @ApiOperation({ summary: 'Fetch one eye record' })
  @ApiOkResponse({ description: 'The eye record' })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<AdminEyeRecordRow> {
    return this.eyeRecords.getAsAdmin(id, user);
  }

  @RequirePermission('eye_records.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Set an eye record’s review status',
    description:
      'Moves a record between `submitted`, `reviewed` and `archived`. ' +
      '`reviewed_at`/`reviewed_by` are stamped or cleared server-side to match, ' +
      'so the three can never disagree.',
  })
  @ApiOkResponse({ description: 'The updated eye record' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEyeRecordStatusDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<AdminEyeRecordRow> {
    return this.eyeRecords.updateStatusAsAdmin(id, dto.status, actorUser);
  }
}
