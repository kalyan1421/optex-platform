import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Query parameters for full-text product search (`GET /products/search`).
 */
export class SearchQueryDto {
  @ApiProperty({ description: 'Free-text search query', example: 'ray ban aviator' })
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({
    description: '1-based page number',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 24,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 24;
}
