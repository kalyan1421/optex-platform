import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import { DevicesService } from './devices.service';
import { DeregisterDeviceDto, RegisterDeviceDto } from './dto/device.dto';

/**
 * Device registration for push notifications, mounted at `/api/devices`
 * (SPEC-11 B-1). Customer-only: every route sits behind the global auth guard
 * with no `@Public()`, and staff accounts have no customer profile to register a
 * device against.
 */
@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Register this device for push notifications (idempotent)',
    description:
      'Registers an FCM token for the signed-in customer, or refreshes it. A token identifies a device, ' +
      'so registering one that belongs to someone else moves it to the caller. `mutedCategories` is the ' +
      "device's opt-out set and is honoured server-side.",
  })
  @ApiNoContentResponse({ description: 'Registered' })
  async register(
    @CurrentUser('id') authUserId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<void> {
    await this.devices.register(authUserId, dto);
  }

  @Post('deregister')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop sending push notifications to this device (e.g. on sign-out)' })
  @ApiNoContentResponse({ description: 'Deregistered, or there was nothing to deregister' })
  async deregister(
    @CurrentUser('id') authUserId: string,
    @Body() dto: DeregisterDeviceDto,
  ): Promise<void> {
    await this.devices.deregister(authUserId, dto);
  }
}
