import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/notification_category.dart';

/// The order / appointment / offer filter (SPEC-11 P0-11).
///
/// The three chips are generated from [NotificationCategory.values], so they
/// cannot drift from the `@IsIn` list the API validates against. Selection is
/// sent to the server as `?category=`; filtering client-side would give a
/// wrong count on any page but the first.
class CategoryFilterBar extends StatelessWidget {
  const CategoryFilterBar({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final NotificationCategory? selected;
  final ValueChanged<NotificationCategory?> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        children: <Widget>[
          _chip(context, label: 'All', value: null),
          for (final NotificationCategory category in NotificationCategory.values)
            _chip(context, label: category.label, value: category),
        ],
      ),
    );
  }

  Widget _chip(
    BuildContext context, {
    required String label,
    required NotificationCategory? value,
  }) {
    final bool isSelected = selected == value;
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: Center(
        child: ChoiceChip(
          label: Text(label),
          selected: isSelected,
          onSelected: (_) => onSelected(value),
        ),
      ),
    );
  }
}
