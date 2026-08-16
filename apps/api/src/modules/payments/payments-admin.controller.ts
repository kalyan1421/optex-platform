import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../auth/decorators';
import type { AuthUser } from '../../auth/auth-user';
import { AdminListPaymentsQueryDto } from './dto/admin-list-payments-query.dto';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
import { LinkPaymentDto } from './dto/link-payment.dto';
import { AdminPaymentView, PaginatedPayments, ReconcileResult } from './dto/payment-views';
import { PaymentsService } from './payments.service';

/**
 * Super-admin payment management, mounted at `/api/admin/payments`. Gated by
 * `payments.*` permissions (`@RequirePermission`) on top of the global JWT
 * guard. Addresses MISSING_FEATURES A-2 (unified payment ledger) and P-6
 * (manual reconcile). No `branch_id` column on either transaction table, so
 * this stays Accountant/Super-Admin-only — not scoped to Branch Manager.
 */
@ApiTags('payments')
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @RequirePermission('payments.read')
  @Get()
  @ApiOperation({
    summary: 'Unified list of M-Pesa + Pesapal transactions (filters + paging)',
  })
  @ApiOkResponse({ description: 'Paginated, merged payment transactions' })
  list(@Query() query: AdminListPaymentsQueryDto): Promise<PaginatedPayments<AdminPaymentView>> {
    return this.payments.adminListPayments(query);
  }

  @RequirePermission('payments.reconcile')
  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Re-query the provider and reconcile a transaction + its order',
  })
  @ApiOkResponse({ description: 'Reconcile outcome' })
  reconcile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReconcilePaymentDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<ReconcileResult> {
    return this.payments.adminReconcile(id, dto.provider, actorUser);
  }

  @RequirePermission('payments.reconcile')
  @Post(':id/link')
  @ApiOperation({
    summary: 'Manually link an orphan transaction to an order and credit it',
  })
  @ApiOkResponse({ description: 'Link outcome' })
  link(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkPaymentDto,
    @CurrentUser() actorUser: AuthUser,
  ): Promise<ReconcileResult> {
    return this.payments.adminLinkPayment(id, dto.provider, dto.orderNumber, actorUser);
  }

  @RequirePermission('payments.read')
  @Get('attention')
  @ApiOperation({
    summary: 'Payments needing manual handling — paid-and-cancelled orders, and reversals',
  })
  @ApiOkResponse({ description: 'Two groups; read-only, no action is taken' })
  needingAttention() {
    return this.payments.adminPaymentsNeedingAttention();
  }
}
