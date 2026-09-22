import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../catalog_strings.dart';
import '../domain/category.dart';
import '../state/catalog_providers.dart';
import '../state/product_list_controller.dart';
import 'widgets/product_list_view.dart';

/// `/category/:slug` — one category's products, with the category itself
/// fetched separately for the title.
///
/// Two requests rather than one because the API has no combined endpoint:
/// `GET /categories/:slug` gives the name (and 404s for a bad slug), while
/// `GET /products?category=<slug>` gives the products. The products list is
/// the page, so a failure to load the *name* degrades to the slug rather than
/// blocking the grid.
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Category> category = ref.watch(categoryBySlugProvider(slug));

    return Scaffold(
      appBar: AppBar(
        title: Text(category.value?.name ?? slug),
        actions: <Widget>[
          IconButton(
            onPressed: () => context.push(Routes.search),
            icon: const Icon(Icons.search_rounded),
            tooltip: CatalogStrings.searchTitle,
          ),
        ],
      ),
      body: category.hasError && _isNotFound(category)
          ? _NotFound(slug: slug)
          : ProductListView(
              provider: browseListProvider(ProductListId.category(slug)),
              storageKey: 'category:$slug',
              lockedCategorySlug: slug,
              unfilteredEmptyTitle: CatalogStrings.emptyCategory,
              unfilteredEmptyMessage: CatalogStrings.emptyCategoryBody,
            ),
    );
  }

  /// Only a 404 means the category is genuinely wrong. Any other failure —
  /// a timeout, a 500 — is about the *name* request, and the products grid
  /// underneath can still do its job.
  bool _isNotFound(AsyncValue<Category> category) {
    final Object? error = category.error;
    return error is ApiException && error.isNotFound;
  }
}

class _NotFound extends StatelessWidget {
  const _NotFound({required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: AppEmptyState(
        title: CatalogStrings.categoryNotFound,
        message: slug,
        icon: Icons.category_outlined,
        action: FilledButton(
          onPressed: () => context.go(Routes.shop),
          child: const Text(CatalogStrings.backToShop),
        ),
      ),
    );
  }
}
