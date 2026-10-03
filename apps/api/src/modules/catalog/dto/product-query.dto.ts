import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Allowed sort orders for the product list. */
export enum ProductSort {
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  Newest = 'newest',
  Featured = 'featured',
}

/**
 * Query parameters for the paginated public product list (`GET /products`).
 * All filters are optional; absent filters are not applied.
 */
export class ProductQueryDto {
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

  @ApiPropertyOptional({
    description: 'Category slug or UUID to filter by',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Exact brand name to filter by' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Frame shape (round, square, aviator, cat-eye, ...)',
  })
  @IsString()
  @IsOptional()
  shape?: string;

  @ApiPropertyOptional({ description: 'Gender (men, women, unisex, kids)' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Frame material to filter by' })
  @IsString()
  @IsOptional()
  material?: string;

  @ApiPropertyOptional({ description: 'Minimum price in KES (inclusive)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in KES (inclusive)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ProductSort,
    default: ProductSort.Newest,
  })
  @IsEnum(ProductSort)
  @IsOptional()
  sort: ProductSort = ProductSort.Newest;

  /**
   * Homepage curation (migration 0041). These are an OVERRIDE, not an ordinary
   * filter: when no product carries the flag the service returns the
   * newest-first list instead of an empty one, so an uncurated catalogue still
   * renders a populated homepage. See `ProductsService.list`.
   *
   * `Transform` is needed because query strings arrive as `'true'`/`'false'`
   * text; `@Type(() => Boolean)` would coerce the string `'false'` to `true`.
   */
  @ApiPropertyOptional({
    description:
      'Only products pinned to the homepage "Featured Products" section. Falls back to newest-first when none are pinned.',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({
    description:
      'Only products pinned to the homepage "Trending Now" section. Falls back to newest-first when none are pinned.',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  trending?: boolean;
}
