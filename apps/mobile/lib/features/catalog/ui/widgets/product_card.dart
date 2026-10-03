import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/models/money.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/product.dart';
import 'add_to_cart_button.dart';
import 'product_image.dart';
import 'star_rating.dart';
import 'stock_notice.dart';

/// One product, as a grid tile.
///
/// Mirrors the storefront card's information architecture — photo, frame
/// shape, name, brand, rating, price, add-to-cart — minus the desktop
/// chrome. Wishlist and compare toggles are absent on purpose: both belong to
/// other slices (P1-1 wishlist; compare has no mobile story at all).
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.showAddToCart = true,
  });

  final Product product;
  final bool showAddToCart;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool unavailable = !product.isPurchasable;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Routes.productOf(product.slug)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: <Widget>[
                  Opacity(
                    opacity: unavailable ? 0.45 : 1,
                    child: ProductImage(url: product.primaryImageUrl),
                  ),
                  if (product.frameShape != null)
                    Positioned(
                      top: AppSpacing.sm,
                      right: AppSpacing.sm,
                      child: _ShapePill(label: product.frameShape!),
                    ),
                  if (unavailable)
                    const Positioned(
                      left: AppSpacing.sm,
                      bottom: AppSpacing.sm,
                      child: OutOfStockBadge(),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.sm + AppSpacing.xs,
                AppSpacing.sm,
                AppSpacing.sm,
                AppSpacing.sm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  if (product.brand != null)
                    Text(
                      product.brand!.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.primary,
                        letterSpacing: 0.8,
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  StarRating(
                    average: product.ratingAvg,
                    count: product.ratingCount,
                    size: 13,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          formatKes(product.priceKes),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (showAddToCart) AddToCartIconButton(product: product),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShapePill extends StatelessWidget {
  const _ShapePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs / 2,
        ),
        child: Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// The same product as a fixed-width tile for a horizontal rail.
class ProductRailCard extends StatelessWidget {
  const ProductRailCard({super.key, required this.product, this.width = 168});

  final Product product;
  final double width;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: ProductCard(product: product, showAddToCart: false),
  );
}
