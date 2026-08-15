import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Query parameters for full-text product search (`GET /products/search`).
 */
export class SearchQueryDto {
  @ApiProperty({
    description: 'Free-text search query',
    example: 'ray ban aviator',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  // F-19 FIX: the query reaches `websearch_to_tsquery` and, when that returns
  // nothing, an `ilike` fallback that cannot use an index. Unbounded, that is a
  // few bytes of request buying an arbitrarily expensive scan. 120 characters is
  // far more than any real product search and cheap to reject.
  @MaxLength(120)
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
