import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { AdminListPaymentsQueryDto } from './dto/admin-list-payments-query.dto';
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
import { LinkPaymentDto } from './dto/link-payment.dto';
import { AdminPaymentView, PaginatedPayments, ReconcileResult } from './dto/payment-views';
import { PaymentsService } from './payments.service';

/**
 * Super-admin payment management, mounted at `/api/admin/payments`. Gated by
 * `@Roles('super_admin')` on top of the global JWT guard. Addresses
 * MISSING_FEATURES A-2 (unified payment ledger) and P-6 (manual reconcile).
 */
@ApiTags('payments')
@Roles('super_admin')
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Unified list of M-Pesa + Pesapal transactions (filters + paging)',
  })
  @ApiOkResponse({ description: 'Paginated, merged payment transactions' })
  list(@Query() query: AdminListPaymentsQueryDto): Promise<PaginatedPayments<AdminPaymentView>> {
    return this.payments.adminListPayments(query);
  }

  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Re-query the provider and reconcile a transaction + its order',
  })
  @ApiOkResponse({ description: 'Reconcile outcome' })
  reconcile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReconcilePaymentDto,
  ): Promise<ReconcileResult> {
    return this.payments.adminReconcile(id, dto.provider);
  }

  @Post(':id/link')
  @ApiOperation({
    summary: 'Manually link an orphan transaction to an order and credit it',
  })
  @ApiOkResponse({ description: 'Link outcome' })
  link(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkPaymentDto,
  ): Promise<ReconcileResult> {
    return this.payments.adminLinkPayment(id, dto.provider, dto.orderNumber);
  }
  @Get('attention')
  @ApiOperation({
    summary: 'Payments needing manual handling — paid-and-cancelled orders, and reversals',
  })
  @ApiOkResponse({ description: 'Two groups; read-only, no action is taken' })
  needingAttention() {
    return this.payments.adminPaymentsNeedingAttention();
  }
}
