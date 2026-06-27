import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators';
import { AdminMetricsService } from './admin-metrics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  AnalyticsResponse,
  DashboardResponse,
} from './dto/metrics-response.dto';

/**
 * ADMIN METRICS endpoints — dashboard KPIs + analytics reporting.
 *
 * Mounted at `/api/admin` (global `api` prefix applied in `main.ts`). Every
 * route is `super_admin`-only (class-level `@Roles`), enforced by the global
 * auth + roles guards. Bearer auth is required.
 */
@ApiTags('admin-metrics')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin')
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Dashboard KPIs, recent orders, top products, and daily revenue series',
  })
  @ApiOkResponse({ description: 'Dashboard metrics for the requested range' })
  dashboard(@Query() query: DashboardQueryDto): Promise<DashboardResponse> {
    return this.metrics.dashboard(query);
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      'Sales summary, top products, order volume by day, and revenue by category',
  })
  @ApiOkResponse({ description: 'Analytics report for the requested date range' })
  analytics(@Query() query: AnalyticsQueryDto): Promise<AnalyticsResponse> {
    return this.metrics.analytics(query);
  }
}
