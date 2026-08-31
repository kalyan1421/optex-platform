import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { CustomersService } from './customers.service';
import { AdminCustomerDto } from './dto/customer.dto';
import { SetCustomerStatusDto } from './dto/set-customer-status.dto';

/**
 * Customer directory. Mounted at `/api/admin/customers` (global prefix applied
 * in `main.ts`). Every route requires a `customers.*` permission, enforced by
 * the global `PermissionsGuard` via `@RequirePermission`.
 *
 * `customers.read` is held by the two branch-scoped roles as well as Super
 * Admin, so the list is branch-scoped server-side from the caller's JWT
 * (audit A-01) — never from a client-supplied branch. `customers.write` is
 * Super Admin only, so `setStatus` needs no equivalent filter.
 */
@ApiTags('customers')
@ApiBearerAuth()
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermission('customers.read')
  @Get()
  @ApiOperation({ summary: 'List customers with their orders' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Case-insensitive match across name, email and phone.',
  })
  @ApiOkResponse({ type: [AdminCustomerDto], description: 'Customers, newest signup first' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
  ): Promise<AdminCustomerDto[]> {
    // `user.branchId` is set only for the branch-scoped roles; Super Admin
    // passes `undefined` and keeps the unscoped directory.
    return this.customers.listForAdmin(search?.trim() || undefined, user.branchId ?? undefined);
  }

  @RequirePermission('customers.write')
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
    @CurrentUser() actorUser: AuthUser,
  ): Promise<AdminCustomerDto> {
    return this.customers.setStatusAsAdmin(id, dto.status, actorUser);
  }
}
