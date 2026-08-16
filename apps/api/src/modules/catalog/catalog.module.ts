import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * CATALOG module — products + categories.
 *
 * Public storefront reads (list / search / detail / related / categories) and
 * admin-only writes (create / update / soft-delete / image upload). Relies on
 * the global `SupabaseModule` for the service-role client and the global auth
 * guards for `@Public()` / `@RequirePermission('products.read'|'products.write')`
 * enforcement.
 */
@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService],
  exports: [ProductsService, CategoriesService],
})
export class CatalogModule {}
