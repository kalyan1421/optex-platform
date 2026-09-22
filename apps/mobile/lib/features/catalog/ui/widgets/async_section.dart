import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/async_views.dart';
import '../../catalog_strings.dart';

/// Renders one `AsyncValue` inside a fixed-height strip, with all three
/// states honoured.
///
/// The home screen is a column of independent sections, each with its own
/// request. A bare `.when` would let one failed section either blank itself
/// out or collapse the layout; giving every section the same height and the
/// same loading / error / empty vocabulary means a slow banner request does
/// not shuffle the products underneath it once it lands.
class AsyncSection<T> extends StatelessWidget {
  const AsyncSection({
    super.key,
    required this.value,
    required this.height,
    required this.builder,
    required this.isEmpty,
    required this.empty,
    required this.onRetry,
    this.stateHeight,
  });

  final AsyncValue<T> value;

  /// Height of the loaded section.
  final double height;

  /// Height of the loading / error / empty states, when they need more room
  /// than the content does. `AppErrorView` and `AppEmptyState` are full
  /// vocabulary — icon, message, action — and will not fold into the 64pt
  /// strip a row of category chips occupies.
  final double? stateHeight;
  final Widget Function(BuildContext context, T data) builder;

  /// Whether the loaded data is "nothing to show".
  final bool Function(T data) isEmpty;

  /// What to show when it is.
  final Widget empty;

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final double tall = stateHeight ?? height;

    return value.when(
      loading: () => SizedBox(height: tall, child: const AppLoading()),
      error: (Object error, StackTrace _) => SizedBox(
        height: tall,
        child: AppErrorView(error: error, onRetry: onRetry),
      ),
      data: (T data) => isEmpty(data)
          ? SizedBox(height: tall, child: empty)
          : SizedBox(height: height, child: builder(context, data)),
    );
  }
}

/// A one-line failure notice for a section that is decorative rather than
/// load-bearing, where a full [AppErrorView] would shout.
class InlineSectionError extends StatelessWidget {
  const InlineSectionError({
    super.key,
    required this.error,
    required this.onRetry,
  });

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String message = error is ApiException
        ? (error as ApiException).message
        : CatalogStrings.loadMoreFailed;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: theme.colorScheme.error,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text(CatalogStrings.retry),
          ),
        ],
      ),
    );
  }
}
