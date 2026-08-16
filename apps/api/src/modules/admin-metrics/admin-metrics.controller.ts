import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { AdminMetricsService } from './admin-metrics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { AnalyticsResponse, DashboardResponse } from './dto/metrics-response.dto';

/**
 * ADMIN METRICS endpoints — dashboard KPIs + analytics reporting.
 *
 * Mounted at `/api/admin` (global `api` prefix applied in `main.ts`). Gated by
 * `dashboard.read`/`analytics.read` (`@RequirePermission`), held today by
 * Super Admin and Accountant only. Branch Manager/Staff do NOT get these in
 * R1 — there is no branch-attribution rule for revenue/KPIs yet; that ships
 * with R4 (branch P&L). Bearer auth is required.
 */
@ApiTags('admin-metrics')
@ApiBearerAuth()
@Controller('admin')
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @RequirePermission('dashboard.read')
  @Get('dashboard')
  @ApiOperation({
    summary: 'Dashboard KPIs, recent orders, top products, and daily revenue series',
  })
  @ApiOkResponse({ description: 'Dashboard metrics for the requested range' })
  dashboard(@Query() query: DashboardQueryDto): Promise<DashboardResponse> {
    return this.metrics.dashboard(query);
  }

  @RequirePermission('analytics.read')
  @Get('analytics')
  @ApiOperation({
    summary: 'Sales summary, top products, order volume by day, and revenue by category',
  })
  @ApiOkResponse({ description: 'Analytics report for the requested date range' })
  analytics(@Query() query: AnalyticsQueryDto): Promise<AnalyticsResponse> {
    return this.metrics.analytics(query);
  }
}
