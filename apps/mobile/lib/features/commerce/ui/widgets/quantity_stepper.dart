import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';

/// Minus / quantity / plus.
///
/// Deliberately has no maximum. The bounds live in the database
/// (`0034_cart_qty_bounds.sql` holds a line to 1..100) and in the DTO, and a
/// client-side ceiling would be a second copy of a rule that can move without
/// the app shipping. "+" always asks; if the answer is no, the server says why
/// and the caller shows that.
///
/// Minus at a quantity of 1 removes the line rather than being disabled, which
/// is also the API's contract — `PATCH` with `quantity: 0` deletes it.
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onChanged,
    this.busy = false,
  });

  final int quantity;

  /// Called with the new absolute quantity. Zero means "remove".
  final ValueChanged<int> onChanged;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _StepButton(
            icon: quantity <= 1
                ? Icons.delete_outline_rounded
                : Icons.remove_rounded,
            tooltip: quantity <= 1 ? 'Remove from cart' : 'Reduce quantity',
            onPressed: busy ? null : () => onChanged(quantity - 1),
          ),
          SizedBox(
            width: 40,
            child: Center(
              child: busy
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text('$quantity', style: theme.textTheme.titleSmall),
            ),
          ),
          _StepButton(
            icon: Icons.add_rounded,
            tooltip: 'Increase quantity',
            onPressed: busy ? null : () => onChanged(quantity + 1),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.tooltip,
    this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    onPressed: onPressed,
    icon: Icon(icon, size: 18),
    tooltip: tooltip,
    constraints: const BoxConstraints(
      minWidth: AppSpacing.minTapTarget,
      minHeight: AppSpacing.minTapTarget,
    ),
    padding: EdgeInsets.zero,
    visualDensity: VisualDensity.compact,
  );
}
