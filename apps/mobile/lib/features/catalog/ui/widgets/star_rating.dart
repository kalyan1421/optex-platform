import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../catalog_strings.dart';

/// `rating_avg` / `rating_count` rendered as stars (migrations `0024`).
///
/// A product with no approved reviews shows "No reviews yet", never zero
/// stars — `rating_avg` is null in that case, and drawing five empty stars
/// would read as a terrible score rather than an absent one.
class StarRating extends StatelessWidget {
  const StarRating({
    super.key,
    required this.average,
    required this.count,
    this.size = 16,
    this.showCount = true,
  });

  final double? average;
  final int count;
  final double size;
  final bool showCount;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final double? value = average;

    if (value == null || count <= 0) {
      return Text(
        CatalogStrings.noReviewsYet,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.outline,
        ),
      );
    }

    return Semantics(
      label:
          '${value.toStringAsFixed(1)} out of 5, ${CatalogStrings.reviewCount(count)}',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int i = 1; i <= 5; i++)
            Icon(
              value >= i
                  ? Icons.star_rounded
                  : (value >= i - 0.5
                        ? Icons.star_half_rounded
                        : Icons.star_outline_rounded),
              size: size,
              color: AppColors.brandRed,
            ),
          if (showCount) ...<Widget>[
            const SizedBox(width: AppSpacing.xs),
            Text(
              '${value.toStringAsFixed(1)} ($count)',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
