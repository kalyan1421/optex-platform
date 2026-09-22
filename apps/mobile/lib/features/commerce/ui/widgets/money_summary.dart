import 'package:flutter/material.dart';

import '../../../../core/models/money.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/money_row.dart';

/// Renders a server-computed money breakdown.
///
/// Takes a list rather than named subtotal/VAT/total parameters so a new
/// server-side adjustment is a new row and not a new widget (SPEC-11 P2-5).
/// Nothing here adds anything up.
class MoneySummary extends StatelessWidget {
  const MoneySummary({super.key, required this.rows, this.footnote});

  final List<MoneyRow> rows;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final MoneyRow row in rows) ...<Widget>[
          if (row.emphasis == MoneyRowEmphasis.total)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Divider(height: 1),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        row.label,
                        style: row.emphasis == MoneyRowEmphasis.total
                            ? theme.textTheme.titleMedium
                            : theme.textTheme.bodyMedium,
                      ),
                      if (row.note != null && row.note!.isNotEmpty)
                        Text(
                          row.note!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.outline,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Text(
                  _amountText(row),
                  style: switch (row.emphasis) {
                    MoneyRowEmphasis.total =>
                      theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    MoneyRowEmphasis.credit =>
                      theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    MoneyRowEmphasis.normal => theme.textTheme.bodyMedium,
                  },
                ),
              ],
            ),
          ),
        ],
        if (footnote != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Text(
            footnote!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
      ],
    );
  }

  static String _amountText(MoneyRow row) {
    final String amount = formatKes(row.amountKes);
    return row.emphasis == MoneyRowEmphasis.credit ? '-$amount' : amount;
  }
}
