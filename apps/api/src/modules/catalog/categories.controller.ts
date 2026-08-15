import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { CategoriesService, CategoryRow } from './categories.service';

/**
 * Product category endpoints. Public read. Mounted at `/api/categories`
 * (global `api` prefix applied in `main.ts`).
 */
@ApiTags('catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List product categories' })
  @ApiOkResponse({ description: 'Categories ordered by sort_order' })
  list(): Promise<CategoryRow[]> {
    return this.categories.list();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single category by slug' })
  @ApiParam({ name: 'slug' })
  @ApiOkResponse({ description: 'The category row' })
  findBySlug(@Param('slug') slug: string): Promise<CategoryRow> {
    return this.categories.findBySlug(slug);
  }
}
