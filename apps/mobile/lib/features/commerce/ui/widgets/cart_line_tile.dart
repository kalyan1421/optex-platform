import 'package:flutter/material.dart';

import '../../../../core/models/money.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/cart.dart';
import 'line_option_chips.dart';
import 'product_thumbnail.dart';
import 'quantity_stepper.dart';

/// One cart line.
///
/// The money shown is [CartLine.lineTotalKes] — the server's figure for this
/// line. The "each" price beside it is context, not arithmetic: nothing here
/// multiplies a unit price by a quantity.
class CartLineTile extends StatelessWidget {
  const CartLineTile({
    super.key,
    required this.line,
    required this.onQuantityChanged,
    required this.onRemove,
    this.busy = false,
  });

  final CartLine line;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onRemove;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final num? unit = line.unitPriceKes;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          ProductThumbnail(imageUrl: line.product.imageUrl),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                if (line.product.brand != null &&
                    line.product.brand!.isNotEmpty)
                  Text(
                    line.product.brand!.toUpperCase(),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.outline,
                      letterSpacing: 0.6,
                    ),
                  ),
                Text(line.product.name, style: theme.textTheme.titleSmall),
                LineOptionChips(option: line.option),
                if (unit != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xs),
                    child: Text(
                      '${formatKes(unit)} each',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: <Widget>[
                    QuantityStepper(
                      quantity: line.quantity,
                      busy: busy,
                      onChanged: onQuantityChanged,
                    ),
                    const Spacer(),
                    Text(
                      formatKes(line.lineTotalKes),
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: busy ? null : onRemove,
            icon: const Icon(Icons.close_rounded, size: 18),
            tooltip: 'Remove ${line.product.name}',
            color: theme.colorScheme.outline,
          ),
        ],
      ),
    );
  }
}
