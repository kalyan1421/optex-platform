import 'package:flutter/material.dart';

import '../../../../core/models/money.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/line_option.dart';

/// Shows a line's per-item configuration.
///
/// Renders nothing today — no line carries options until SPEC-07's lens and
/// coating configurator lands. It is wired in now so that when it does, the
/// cart and order screens already display what the customer chose instead of
/// showing two visually identical lines at different prices.
class LineOptionChips extends StatelessWidget {
  const LineOptionChips({super.key, required this.option});

  final LineOption? option;

  @override
  Widget build(BuildContext context) {
    final LineOption? value = option;
    if (value == null) return const SizedBox.shrink();

    final ThemeData theme = Theme.of(context);
    final num? surcharge = value.priceKes;

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Wrap(
        spacing: AppSpacing.xs,
        runSpacing: AppSpacing.xs,
        children: <Widget>[
          for (final ({String label, String value}) entry in value.entries)
            _Chip(text: '${entry.label}: ${entry.value}'),
          if (surcharge != null && surcharge > 0)
            _Chip(
              text: '+${formatKes(surcharge)}',
              tone: theme.colorScheme.primary,
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text, this.tone});

  final String text;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs / 2,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: tone ?? theme.dividerColor),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: theme.textTheme.bodySmall?.copyWith(
          color: tone ?? theme.colorScheme.outline,
        ),
      ),
    );
  }
}
