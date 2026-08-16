import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Query for `GET /admin/audit-log` — optional filters + pagination. */
export class AdminAuditLogQueryDto {
  @ApiPropertyOptional({ description: "Filter by resource table, e.g. 'staff_users'." })
  @IsString()
  @IsOptional()
  resourceType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter to one actor.' })
  @IsUUID()
  @IsOptional()
  actorUserId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Filter to one branch (the actor's, at the time).",
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — entries at or after this timestamp.' })
  @IsISO8601()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — entries at or before this timestamp.' })
  @IsISO8601()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  pageSize?: number = 50;
}
