import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/money.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../catalog_strings.dart';
import '../domain/product.dart';
import '../state/catalog_providers.dart';
import 'widgets/add_to_cart_button.dart';
import 'widgets/async_section.dart';
import 'widgets/product_image.dart';
import 'widgets/product_rail.dart';
import 'widgets/section_header.dart';
import 'widgets/star_rating.dart';
import 'widgets/stock_notice.dart';

/// `/product/:slug` — the product detail page.
///
/// Gallery, price through `formatKes`, `rating_avg` / `rating_count` as
/// stars, stock state, and related products. A product with zero stock keeps
/// its page — the customer still wants to see the frame — but the add-to-cart
/// control is disabled and the reason is stated beside it.
class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends ConsumerState<ProductScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final AsyncValue<Product> product = ref.watch(
      productBySlugProvider(widget.slug),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          product.value?.name ?? CatalogStrings.productTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: product.when(
        loading: () => const AppLoading(),
        error: (Object error, StackTrace _) => _error(error),
        data: (Product data) => _Details(
          product: data,
          quantity: _quantity,
          onQuantityChanged: (int q) => setState(() => _quantity = q),
        ),
      ),
      bottomNavigationBar: product.value == null
          ? null
          : _PurchaseBar(
              product: product.value!,
              quantity: _quantity,
              onQuantityChanged: (int q) => setState(() => _quantity = q),
            ),
    );
  }

  Widget _error(Object error) {
    // A 404 here is not a fault to retry — the product is gone or was never
    // active — so it gets a way out instead of a "Try again" that cannot work.
    if (error is ApiException && error.isNotFound) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: AppEmptyState(
          title: CatalogStrings.productNotFound,
          message: CatalogStrings.productNotFoundBody,
          icon: Icons.visibility_off_outlined,
          action: FilledButton(
            onPressed: () => context.go(Routes.shop),
            child: const Text(CatalogStrings.backToShop),
          ),
        ),
      );
    }

    return AppErrorView(
      error: error,
      onRetry: () => ref.invalidate(productBySlugProvider(widget.slug)),
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({
    required this.product,
    required this.quantity,
    required this.onQuantityChanged,
  });

  final Product product;
  final int quantity;
  final ValueChanged<int> onQuantityChanged;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      children: <Widget>[
        _Gallery(product: product),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (product.brand != null)
                Text(
                  product.brand!.toUpperCase(),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: AppColors.brandRed,
                    letterSpacing: 1.6,
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                product.name,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              StarRating(
                average: product.ratingAvg,
                count: product.ratingCount,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                formatKes(product.priceKes),
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.primary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              StockNotice(product: product),
              const SizedBox(height: AppSpacing.lg),
              Text(
                CatalogStrings.description,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                product.description ?? CatalogStrings.noDescription,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: product.description == null
                      ? theme.colorScheme.outline
                      : null,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                CatalogStrings.details,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _Specs(product: product),
            ],
          ),
        ),
        _Related(product: product),
      ],
    );
  }
}

/// Swipeable image gallery. Falls back to the placeholder when the product's
/// `images` array is empty or none of its entries resolve.
class _Gallery extends StatefulWidget {
  const _Gallery({required this.product});

  final Product product;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  static const double _height = 320;

  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final List<String> urls = widget.product.galleryUrls;
    final ThemeData theme = Theme.of(context);

    if (urls.isEmpty) {
      return const SizedBox(
        height: _height,
        child: ProductImage(url: null, showLabelOnError: true),
      );
    }

    return SizedBox(
      height: _height,
      child: Stack(
        children: <Widget>[
          PageView.builder(
            controller: _controller,
            itemCount: urls.length,
            onPageChanged: (int i) => setState(() => _index = i),
            itemBuilder: (BuildContext context, int i) => ProductImage(
              url: urls[i],
              padding: AppSpacing.md,
              showLabelOnError: true,
            ),
          ),
          if (widget.product.isOutOfStock)
            const Positioned(
              left: AppSpacing.md,
              top: AppSpacing.md,
              child: OutOfStockBadge(),
            ),
          if (urls.length > 1)
            Positioned(
              right: AppSpacing.md,
              bottom: AppSpacing.md,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(AppSpacing.md),
                  border: Border.all(color: theme.dividerColor),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  child: Text(
                    '${_index + 1}/${urls.length}',
                    style: theme.textTheme.labelSmall,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Specs extends StatelessWidget {
  const _Specs({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final List<(String, String)> rows = <(String, String)>[
      if (product.brand != null) (CatalogStrings.detailBrand, product.brand!),
      if (product.frameShape != null)
        (CatalogStrings.detailShape, product.frameShape!),
      if (product.frameMaterial != null)
        (CatalogStrings.detailMaterial, product.frameMaterial!),
      if (product.gender != null)
        (CatalogStrings.detailGender, product.gender!),
      if (product.sku.isNotEmpty) (CatalogStrings.detailSku, product.sku),
    ];

    if (rows.isEmpty) {
      return Text(
        CatalogStrings.noDescription,
        style: Theme.of(context).textTheme.bodySmall,
      );
    }

    final ThemeData theme = Theme.of(context);
    return Column(
      children: <Widget>[
        for (final (String label, String value) in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SizedBox(
                  width: 110,
                  child: Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    value,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Related extends ConsumerWidget {
  const _Related({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const SectionHeader(title: CatalogStrings.relatedProducts),
        AsyncSection<List<Product>>(
          value: ref.watch(relatedProductsProvider(product.id)),
          height: productRailHeight,
          isEmpty: (List<Product> data) => data.isEmpty,
          empty: const AppEmptyState(
            title: CatalogStrings.noRelated,
            message: CatalogStrings.noRelatedBody,
            icon: Icons.grid_view_rounded,
          ),
          onRetry: () => ref.invalidate(relatedProductsProvider(product.id)),
          builder: (BuildContext context, List<Product> data) =>
              ProductRail(products: data),
        ),
      ],
    );
  }
}

/// The persistent purchase bar.
///
/// One add-to-cart control on the screen, always reachable without scrolling,
/// and disabled — with the reason visible above it — when the product cannot
/// be bought.
class _PurchaseBar extends StatelessWidget {
  const _PurchaseBar({
    required this.product,
    required this.quantity,
    required this.onQuantityChanged,
  });

  final Product product;
  final int quantity;
  final ValueChanged<int> onQuantityChanged;

  /// Never offer more than the server says exists. `place_order` would reject
  /// it anyway (`0020_checkout_stock_enforcement.sql`); refusing here means
  /// the customer finds out now rather than at the payment screen.
  int get _max => product.availableStock ?? 10;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool enabled = product.isPurchasable;

    return Material(
      elevation: 8,
      color: theme.scaffoldBackgroundColor,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: <Widget>[
              if (enabled) ...<Widget>[
                _QuantityStepper(
                  quantity: quantity,
                  max: _max,
                  onChanged: onQuantityChanged,
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: AddToCartButton(product: product, quantity: quantity),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.max,
    required this.onChanged,
  });

  final int quantity;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          IconButton(
            onPressed: quantity > 1 ? () => onChanged(quantity - 1) : null,
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.remove_rounded),
            tooltip: CatalogStrings.decreaseQuantity,
          ),
          Text('$quantity', style: theme.textTheme.titleMedium),
          IconButton(
            onPressed: quantity < max ? () => onChanged(quantity + 1) : null,
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.add_rounded),
            tooltip: CatalogStrings.increaseQuantity,
          ),
        ],
      ),
    );
  }
}
