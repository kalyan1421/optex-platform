import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query parameters for `GET /admin/analytics`.
 *
 * `from` / `to` are inclusive date boundaries (ISO-8601, date or datetime).
 * When omitted the service defaults to the last 30 days. `to` is treated as
 * end-of-day so a calendar-date `to` still includes that whole day.
 *
 * Ranges are bounded in the service (capped span + row cap) because the
 * Supabase JS client cannot GROUP BY — rows in the window are fetched and
 * aggregated in TypeScript.
 */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Inclusive start date (ISO-8601). Defaults to 30 days ago.',
    example: '2026-05-01',
  })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date (ISO-8601). Defaults to now.',
    example: '2026-05-31',
  })
  @IsISO8601()
  @IsOptional()
  to?: string;
}
