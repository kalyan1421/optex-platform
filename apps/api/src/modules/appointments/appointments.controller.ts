import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public, CurrentUser } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AppointmentsService } from './appointments.service';
import { SlotsQueryDto } from './dto/slots-query.dto';
import { SlotsResponseDto } from './dto/slots-response.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentDto } from './dto/appointment.dto';

/**
 * Customer-facing appointment booking. Mounted at `/api/appointments` (global
 * prefix applied in `main.ts`).
 *
 * - `GET /slots` is `@Public()` — anyone can view a branch's availability.
 * - All other routes require a valid JWT and operate on the caller's own
 *   bookings (ownership enforced in the service).
 */
@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Public()
  @Get('slots')
  @ApiOperation({ summary: 'List available booking slots for a branch on a date' })
  @ApiOkResponse({ type: SlotsResponseDto, description: 'Free slot start times' })
  @ApiNotFoundResponse({ description: 'Branch not found' })
  slots(@Query() query: SlotsQueryDto): Promise<SlotsResponseDto> {
    return this.appointments.getAvailableSlots(query.branchId, query.date);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Book an appointment for the current customer' })
  @ApiCreatedResponse({ type: AppointmentDto, description: 'The created booking' })
  @ApiConflictResponse({ description: 'Slot already booked' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentDto> {
    return this.appointments.create(user, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the current customer's bookings" })
  @ApiOkResponse({ type: [AppointmentDto], description: 'The caller bookings' })
  list(@CurrentUser() user: AuthUser): Promise<AppointmentDto[]> {
    return this.appointments.listForCustomer(user);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cancel one of the caller's bookings" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentDto, description: 'The cancelled booking' })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  @ApiConflictResponse({ description: 'Appointment cannot be cancelled' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDto> {
    return this.appointments.cancelOwn(user, id);
  }

  @Patch(':id/reschedule')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reschedule one of the caller's bookings" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AppointmentDto, description: 'The rescheduled booking' })
  @ApiNotFoundResponse({ description: 'Appointment not found' })
  @ApiConflictResponse({ description: 'New slot already booked' })
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<AppointmentDto> {
    return this.appointments.rescheduleOwn(user, id, dto);
  }
}
