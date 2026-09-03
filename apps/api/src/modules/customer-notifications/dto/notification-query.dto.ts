import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const NOTIFICATION_CATEGORIES = ['order', 'appointment', 'offer'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Query for `GET /notifications` — optional filters + pagination. */
export class NotificationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CATEGORIES })
  @IsIn(NOTIFICATION_CATEGORIES)
  @IsOptional()
  category?: NotificationCategory;

  @ApiPropertyOptional({ description: 'Only unread notifications.' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}
