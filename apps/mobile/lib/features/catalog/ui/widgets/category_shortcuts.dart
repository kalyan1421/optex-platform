import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/category.dart';

/// The category row on the home screen.
///
/// Chips rather than the storefront's image tiles: `categories` carries no
/// image column, so a tile would need artwork that does not exist in the
/// schema. A label that is certainly correct beats a picture that has to be
/// invented.
class CategoryShortcuts extends StatelessWidget {
  const CategoryShortcuts({super.key, required this.categories});

  final List<Category> categories;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      itemCount: categories.length,
      separatorBuilder: (BuildContext context, int index) => const SizedBox(width: AppSpacing.sm),
      itemBuilder: (BuildContext context, int index) {
        final Category category = categories[index];
        return Center(
          child: ActionChip(
            label: Text(category.name),
            avatar: Icon(Icons.visibility_outlined, size: 18, color: theme.colorScheme.primary),
            onPressed: () => context.push(Routes.categoryOf(category.slug)),
          ),
        );
      },
    );
  }
}
