import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../data/firebase_bootstrap.dart';
import '../data/push_service.dart';
import '../domain/notification_category.dart';
import '../state/push_providers.dart';

/// Notification settings (SPEC-11 P0-10's "per-category opt-out in settings").
///
/// Also where the permission prompt lives, deliberately: this is the only place
/// in the app where the customer has just expressed an interest in being
/// notified, which is what "in context" means. Nothing prompts at cold start.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<PushState> push = ref.watch(pushControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: push.when(
        loading: () => const AppLoading(),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.invalidate(pushControllerProvider),
        ),
        data: (PushState state) => _SettingsBody(state: state),
      ),
    );
  }
}

class _SettingsBody extends ConsumerWidget {
  const _SettingsBody({required this.state});

  final PushState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      children: <Widget>[
        _StatusCard(state: state),
        const SizedBox(height: AppSpacing.sm),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: Text(
            'What to notify me about',
            style: theme.textTheme.titleSmall,
          ),
        ),
        for (final NotificationCategory category in NotificationCategory.values)
          SwitchListTile.adaptive(
            title: Text(category.label),
            subtitle: Text(_describe(category)),
            value: !state.isMuted(category),
            // Switching is meaningful even before permission is granted: it
            // records the preference the moment push is turned on.
            onChanged: (bool enabled) => ref
                .read(pushControllerProvider.notifier)
                .setMuted(category, !enabled),
          ),
        const Divider(height: AppSpacing.xl),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Text(
            'These switches apply to push notifications on this device. Your '
            'notification centre keeps every update either way.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ),
        if (!state.available) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Text(
              // Honest rather than reassuring: push genuinely does not work in
              // this build, and saying otherwise would send the customer
              // looking for a fault in their phone.
              'Push delivery is not set up in this build yet, so these '
              'preferences are saved but not yet used.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
        ],
      ],
    );
  }

  static String _describe(NotificationCategory category) => switch (category) {
    NotificationCategory.order =>
      'Confirmations, dispatch and delivery updates.',
    NotificationCategory.appointment =>
      'Booking confirmations and visit reminders.',
    NotificationCategory.offer => 'Promotions and new arrivals.',
  };
}

/// The top card: whether push is on, and the one action that can change it.
class _StatusCard extends ConsumerStatefulWidget {
  const _StatusCard({required this.state});

  final PushState state;

  @override
  ConsumerState<_StatusCard> createState() => _StatusCardState();
}

class _StatusCardState extends ConsumerState<_StatusCard> {
  bool _requesting = false;

  Future<void> _enable() async {
    setState(() => _requesting = true);
    try {
      final PushPermission result = await ref
          .read(pushControllerProvider.notifier)
          .enable();
      if (!mounted) return;

      final String? message = switch (result) {
        PushPermission.granted || PushPermission.provisional => null,
        PushPermission.denied =>
          'Notifications are off. You can turn them on in system settings.',
        PushPermission.permanentlyDenied =>
          'Notifications are blocked for Optex. Turn them on in your phone '
              'settings to receive updates.',
        PushPermission.notDetermined => 'No change was made.',
        PushPermission.unavailable =>
          'Push is not available in this build yet.',
      };
      if (message != null) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final PushState state = widget.state;

    final (IconData icon, String title, String body) = switch (state) {
      final PushState s when !s.available => (
        Icons.cloud_off_rounded,
        'Push notifications unavailable',
        'This build has no push configuration yet. Everything still reaches '
            'your notification centre, and reminders still go out by SMS.',
      ),
      final PushState s when s.isEnabled => (
        Icons.notifications_active_rounded,
        'Push notifications are on',
        "You'll get order updates and appointment reminders on this device.",
      ),
      final PushState s when s.permission == PushPermission.permanentlyDenied =>
        (
          Icons.notifications_off_rounded,
          'Notifications are blocked',
          'Turn them back on in your phone settings for Optex.',
        ),
      _ => (
        Icons.notifications_none_rounded,
        'Turn on push notifications',
        'Get told when your order ships and before your next appointment.',
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(icon, size: 20, color: theme.colorScheme.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(title, style: theme.textTheme.titleSmall),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                body,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              if (state.canPrompt) ...<Widget>[
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: _requesting ? null : _enable,
                  child: _requesting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Turn on notifications'),
                ),
              ],
              if (!state.available &&
                  FirebaseBootstrap.lastError != null) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  // Diagnostics, not an apology. Whoever picks up B-1 wants to
                  // see this rather than guess.
                  'Reason: ${FirebaseBootstrap.lastError}',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
