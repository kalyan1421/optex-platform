import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { PrescriptionQueryDto } from './dto/prescription-query.dto';
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto';
import { PrescriptionRow, PrescriptionsService } from './prescriptions.service';

/**
 * Admin prescription viewer. Mounted at `/api/admin/prescriptions` (global
 * `api` prefix). Restricted to `super_admin`. Fixes the admin viewer gap
 * (MISSING_FEATURES A-3): lets staff list and securely download any customer's
 * prescription via short-lived signed URLs.
 */
@ApiTags('admin-prescriptions')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/prescriptions')
export class AdminPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all prescriptions (optionally filtered by customerId)',
  })
  @ApiOkResponse({ description: 'Prescriptions, newest first' })
  list(@Query() query: PrescriptionQueryDto): Promise<PrescriptionRow[]> {
    return this.prescriptions.listAll(query);
  }

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
  ): Promise<PrescriptionRow> {
    return this.prescriptions.updateStatusAsAdmin(id, dto.status);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Short-lived signed download URL for any prescription (admin)',
  })
  @ApiOkResponse({ description: 'Signed URL valid for 60 seconds' })
  download(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.prescriptions.downloadAsAdmin(id);
  }
}
