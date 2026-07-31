import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { CustomersService } from './customers.service';
import { AdminCustomerDto } from './dto/customer.dto';

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
}
