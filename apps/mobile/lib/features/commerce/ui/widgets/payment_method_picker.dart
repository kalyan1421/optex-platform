import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/checkout_draft.dart';

/// Choose a payment rail.
///
/// Only the two the API accepts are listed. Cash on delivery was withdrawn by
/// the client and is rejected by `CheckoutDto`, so offering it would mean a
/// filled-in checkout failing at the last step — see [PaymentMethodOption].
class PaymentMethodPicker extends StatelessWidget {
  const PaymentMethodPicker({
    super.key,
    required this.selected,
    required this.onChanged,
    this.enabled = true,
  });

  final PaymentMethodOption selected;
  final ValueChanged<PaymentMethodOption> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final PaymentMethodOption option in PaymentMethodOption.values)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: InkWell(
              onTap: enabled ? () => onChanged(option) : null,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: option == selected
                        ? theme.colorScheme.primary
                        : theme.dividerColor,
                    width: option == selected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: <Widget>[
                    // A plain icon rather than a `Radio`: the whole tile is
                    // the tap target, and `Radio.groupValue`/`onChanged` are
                    // deprecated in favour of a `RadioGroup` ancestor that
                    // would add a layer for no behaviour.
                    Icon(
                      option == selected
                          ? Icons.radio_button_checked_rounded
                          : Icons.radio_button_off_rounded,
                      color: option == selected
                          ? theme.colorScheme.primary
                          : theme.colorScheme.outline,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(option.label, style: theme.textTheme.titleSmall),
                          Text(
                            option.description,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
