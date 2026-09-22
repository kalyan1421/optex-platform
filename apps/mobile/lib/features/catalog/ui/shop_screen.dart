import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../catalog_strings.dart';
import '../state/product_list_controller.dart';
import 'widgets/product_list_view.dart';

/// `/shop` — the whole catalogue, filtered and sorted on the server.
///
/// State lives in `browseListProvider(ProductListId.shop())`, which is not
/// auto-disposed: opening a product and coming back finds the same page, the
/// same filters and the same scroll offset rather than a fresh page one.
class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key, this.initialCategorySlug});

  /// `/shop?category=<slug>`, so a link or a banner can open the shop
  /// pre-filtered without becoming a different screen.
  final String? initialCategorySlug;

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  static const ProductListId _id = ProductListId.shop();

  @override
  void initState() {
    super.initState();
    final String? slug = widget.initialCategorySlug;
    if (slug == null || slug.isEmpty) return;

    // Applied through the controller, not held in the widget, so it survives
    // the same way every other filter does — and so re-entering /shop without
    // the query parameter does not silently reset it.
    Future<void>.microtask(() {
      if (!mounted) return;
      ref.read(browseListProvider(_id).notifier).setCategory(slug);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(CatalogStrings.shopTitle),
        actions: <Widget>[
          IconButton(
            onPressed: () => context.push(Routes.search),
            icon: const Icon(Icons.search_rounded),
            tooltip: CatalogStrings.searchTitle,
          ),
        ],
      ),
      body: ProductListView(
        provider: browseListProvider(_id),
        storageKey: 'shop',
      ),
    );
  }
}
