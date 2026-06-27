import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Rolling time windows supported by the dashboard. Values map to a number of
 * days counted back from "now" (see `DashboardRangeDays`).
 */
export enum DashboardRange {
  Last7Days = '7d',
  Last30Days = '30d',
  Last90Days = '90d',
}

/** Number of days each {@link DashboardRange} spans. */
export const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = {
  [DashboardRange.Last7Days]: 7,
  [DashboardRange.Last30Days]: 30,
  [DashboardRange.Last90Days]: 90,
};

/**
 * Query parameters for `GET /admin/dashboard`.
 * `range` defaults to a 30-day window when omitted.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Rolling window for the dashboard KPIs and time-series',
    enum: DashboardRange,
    default: DashboardRange.Last30Days,
  })
  @IsEnum(DashboardRange)
  @IsOptional()
  range: DashboardRange = DashboardRange.Last30Days;
}
