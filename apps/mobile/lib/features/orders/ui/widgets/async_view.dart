import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/async_views.dart';

/// Renders an [AsyncValue] through the three core states required by
/// AGENTS.md rule 7 — loading, error with retry, and data.
///
/// Data wins over error when both are present, which happens while a
/// previously-loaded screen is being refreshed: showing the stale order and
/// letting the refresh fail quietly beats replacing a working screen with an
/// error page.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
    this.loadingLabel,
  });

  final AsyncValue<T> value;
  final Widget Function(BuildContext context, T data) builder;
  final VoidCallback? onRetry;
  final String? loadingLabel;

  @override
  Widget build(BuildContext context) {
    final T? data = value.value;
    if (data != null) return builder(context, data);

    final Object? error = value.error;
    if (error != null) return AppErrorView(error: error, onRetry: onRetry);

    return AppLoading(label: loadingLabel);
  }
}
