import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { AppointmentsService } from './appointments.service';
import { AdminAppointmentQueryDto } from './dto/admin-appointment-query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentDto } from './dto/appointment.dto';

/**
 * Super-admin appointment management. Mounted at `/api/admin/appointments`
 * (global prefix applied in `main.ts`). Every route requires
 * `role === 'super_admin'`, enforced by the global `RolesGuard` via `@Roles`.
 */
@ApiTags('appointments')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments (optional branch/status/date filters)' })
  @ApiOkResponse({ type: [AppointmentDto], description: 'Matching appointments' })
  list(@Query() query: AdminAppointmentQueryDto): Promise<AppointmentDto[]> {
    return this.appointments.listForAdmin(query);
  }

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
