import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/product.dart';
import 'product_card.dart';

/// Height that fits a rail card's photo, name, rating and price without
/// clipping. Fixed rather than intrinsic because a horizontal `ListView`
/// gives its children an unbounded main axis and a bounded cross axis — the
/// card needs the bound to decide how much room the photo gets.
const double productRailHeight = 300;

/// A horizontally scrolling row of products, used by the home sections and by
/// "You may also like" on the product screen.
class ProductRail extends StatelessWidget {
  const ProductRail({super.key, required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      itemCount: products.length,
      separatorBuilder: (BuildContext context, int index) =>
          const SizedBox(width: AppSpacing.sm + AppSpacing.xs),
      itemBuilder: (BuildContext context, int index) =>
          ProductRailCard(product: products[index]),
    );
  }
}
