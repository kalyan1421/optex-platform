import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators';
import { CategoriesService, CategoryRow } from './categories.service';

/**
 * Product category endpoints. Public read. Mounted at `/api/categories`
 * (global `api` prefix applied in `main.ts`).
 */
/**
 * Cheap, cacheable public reads — same high ceiling and same reasoning as the
 * product catalogue (F-01 / F-07): anonymous callers behind carrier-grade NAT
 * all share one IP bucket, and these queries are trivial.
 */
const CATALOGUE_READ_LIMIT = Number(process.env.CATALOGUE_RATE_LIMIT ?? 2000);

@ApiTags('catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get()
  @ApiOperation({ summary: 'List product categories' })
  @ApiOkResponse({ description: 'Categories ordered by sort_order' })
  list(): Promise<CategoryRow[]> {
    return this.categories.list();
  }

  @Throttle({ default: { ttl: 60_000, limit: CATALOGUE_READ_LIMIT } })
  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single category by slug' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ description: 'The category row' })
  findBySlug(@Param('slug') slug: string): Promise<CategoryRow> {
    return this.categories.findBySlug(slug);
  }
}
