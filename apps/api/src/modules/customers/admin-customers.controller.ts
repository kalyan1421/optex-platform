import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { CustomersService } from './customers.service';
import { AdminCustomerDto } from './dto/customer.dto';
import { SetCustomerStatusDto } from './dto/set-customer-status.dto';

/**
 * Super-admin customer directory. Mounted at `/api/admin/customers` (global
 * prefix applied in `main.ts`). Every route requires `role === 'super_admin'`,
 * enforced by the global `RolesGuard` via `@Roles`.
 */
@ApiTags('customers')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers with their orders' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive match across name, email and phone.',
  })
  @ApiOkResponse({ type: [AdminCustomerDto], description: 'Customers, newest signup first' })
  list(@Query('search') search?: string): Promise<AdminCustomerDto[]> {
    return this.customers.listForAdmin(search?.trim() || undefined);
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Set a customer's account status (admin)",
    description:
      'Moves a customer between `active` and `deactivated`. Deactivating bans the ' +
      'linked auth user via the Supabase Admin API — not just a display flag — so a ' +
      'deactivated customer genuinely cannot sign in. `deactivated_at` is stamped or ' +
      'cleared server-side to match, so the two can never disagree.',
  })
  @ApiOkResponse({ type: AdminCustomerDto, description: 'The updated customer row' })
  setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetCustomerStatusDto,
  ): Promise<AdminCustomerDto> {
    return this.customers.setStatusAsAdmin(id, dto.status);
  }
}
