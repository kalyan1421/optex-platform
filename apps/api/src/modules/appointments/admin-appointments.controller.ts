import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { AppointmentsService } from './appointments.service';
import { AdminAppointmentQueryDto } from './dto/admin-appointment-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminAppointmentDto, AppointmentDto } from './dto/appointment.dto';

/**
 * Super-admin appointment management. Mounted at `/api/admin/appointments`
 * (global prefix applied in `main.ts`). Every route requires an
 * `appointments.*` permission, enforced by the global `PermissionsGuard`.
 * Branch-scoping the `list` results to Branch Manager/Staff's own branch is
 * R1 sub-phase 1b, not yet done here — see `appointments.service.ts:227`.
 */
@ApiTags('appointments')
@ApiBearerAuth()
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @RequirePermission('appointments.read')
  @Get()
  @ApiOperation({ summary: 'List appointments (optional branch/status/date filters)' })
  @ApiOkResponse({ type: [AppointmentDto], description: 'Matching appointments' })
  list(@Query() query: AdminAppointmentQueryDto): Promise<AdminAppointmentDto[]> {
    return this.appointments.listForAdmin(query);
  }

  @RequirePermission('appointments.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update an appointment (confirm / cancel / set status / reschedule)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentDto, description: 'The updated appointment' })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  @ApiConflictResponse({ description: 'New slot already booked' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ): Promise<AppointmentDto> {
    return this.appointments.updateForAdmin(id, dto);
  }
}
