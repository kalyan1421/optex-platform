import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../catalog_strings.dart';
import '../../domain/product.dart';

/// The four things stock can mean, said out loud.
///
/// `available_stock` is a sum across branches, and **null means unknown** —
/// `ProductsService.withAvailability` returns null when the product has no
/// `inventory` rows at all, deliberately so a pending inventory import does
/// not brand the whole catalogue as sold out. Unknown therefore reads
/// "confirmed at checkout", never "out of stock"; the server enforces the
/// truth in `place_order` either way (`0020_checkout_stock_enforcement.sql`).
class StockNotice extends StatelessWidget {
  const StockNotice({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final (String text, Color color, IconData icon) = _describe(theme);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 18, color: color),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            text,
            style: theme.textTheme.bodyMedium?.copyWith(color: color, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }

  (String, Color, IconData) _describe(ThemeData theme) {
    if (!product.isActive) {
      return (CatalogStrings.unavailableNotice, AppColors.danger, Icons.block_outlined);
    }
    if (product.isOutOfStock) {
      return (CatalogStrings.outOfStockNotice, AppColors.danger, Icons.remove_shopping_cart_outlined);
    }
    if (product.isLowStock) {
      return (
        CatalogStrings.lowStockNotice(product.availableStock!),
        AppColors.warning,
        Icons.hourglass_bottom_rounded,
      );
    }
    if (product.availableStock == null) {
      return (
        CatalogStrings.stockUnknownNotice,
        theme.colorScheme.outline,
        Icons.info_outline_rounded,
      );
    }
    return (CatalogStrings.inStockNotice, AppColors.success, Icons.check_circle_outline_rounded);
  }
}

/// The compact form for a grid tile: shown only when there is bad news.
class OutOfStockBadge extends StatelessWidget {
  const OutOfStockBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.brandDark.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        child: Text(
          CatalogStrings.outOfStock,
          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
