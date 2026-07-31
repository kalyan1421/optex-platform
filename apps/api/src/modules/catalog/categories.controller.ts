import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
