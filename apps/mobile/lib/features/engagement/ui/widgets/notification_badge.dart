import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/routes.dart';
import '../../state/notifications_providers.dart';

/// The app-bar bell with its unread count (SPEC-11 P0-11).
///
/// Exported for the integrator to drop into the shell's app bar. The count
/// comes from `GET /notifications/unread-count` and is refreshed on foreground
/// by [EngagementHost]; while it is loading or errored the bell simply shows no
/// badge, because a wrong number is worse than no number.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, this.onTap});

  /// Defaults to navigating to the notification centre.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int count = ref.watch(unreadCountProvider).value ?? 0;

    return IconButton(
      tooltip: count > 0 ? '$count unread notifications' : 'Notifications',
      onPressed: onTap ?? () => context.push(Routes.notifications),
      icon: UnreadBadge(
        count: count,
        child: const Icon(Icons.notifications_none_rounded),
      ),
    );
  }
}

/// Wraps any widget with a count bubble. Caps the label at 99+.
class UnreadBadge extends StatelessWidget {
  const UnreadBadge({super.key, required this.count, required this.child});

  final int count;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return child;

    final ThemeData theme = Theme.of(context);
    return Badge.count(
      count: count,
      backgroundColor: theme.colorScheme.error,
      textColor: theme.colorScheme.onError,
      child: child,
    );
  }
}
