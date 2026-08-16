import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { PrescriptionRow, PrescriptionsService } from './prescriptions.service';

/**
 * Admin prescription viewer. Mounted at `/api/admin/prescriptions` (global
 * `api` prefix). Gated by `prescriptions.read`/`prescriptions.write`, held
 * only by Super Admin in R1 — prescriptions are health data with no
 * `branch_id` column, so unlike most other admin surfaces this deliberately
 * does NOT extend to Branch Manager. Fixes the admin viewer gap
 * (MISSING_FEATURES A-3): lets staff list and securely download any customer's
 * prescription via short-lived signed URLs.
 */
@ApiTags('admin-prescriptions')
@ApiBearerAuth()
@Controller('admin/prescriptions')
export class AdminPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @RequirePermission('prescriptions.read')
  @Get()
  @ApiOperation({
    summary: 'List all prescriptions (optionally filtered by customerId)',
  })
  @ApiOkResponse({ description: 'Prescriptions, newest first' })
  list(@Query() query: PrescriptionQueryDto): Promise<PrescriptionRow[]> {
    return this.prescriptions.listAll(query);
  }

  @RequirePermission('prescriptions.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Set a prescription’s processing status (admin)',
    description:
      'Moves a prescription between `pending` and `processed`. `processed_at` is ' +
      'stamped or cleared server-side to match, so the two can never disagree.',
  })
  @ApiOkResponse({ description: 'The updated prescription row' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<PrescriptionRow> {
    return this.prescriptions.updateStatusAsAdmin(id, dto.status, actorUser);
  }

  @RequirePermission('prescriptions.read')
  @Get(':id/download')
  @ApiOperation({
    summary: 'Short-lived signed download URL for any prescription (admin)',
  })
  @ApiOkResponse({ description: 'Signed URL valid for 60 seconds' })
  download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.prescriptions.downloadAsAdmin(id, actorUser);
  }
}
