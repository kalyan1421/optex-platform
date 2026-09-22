import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../state/connectivity_providers.dart';

/// The persistent, non-blocking offline notice (SPEC-11 P0-12).
///
/// Non-blocking is the whole point: it is a strip, not a dialog, it swallows no
/// taps, and everything underneath stays usable — cached screens still render
/// and navigation still works. What it must *not* do is let the customer think
/// a failed action succeeded, so screens pair it with disabled controls that
/// say why.
///
/// Renders nothing while connectivity is unknown; a banner shown on a guess is
/// worse than one shown a beat late.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool offline = ref.watch(isOfflineProvider);

    // No entry animation: the host removes the child's top inset in the same
    // frame the banner appears, and animating one but not the other makes the
    // whole app judder.
    return offline ? const _OfflineStrip() : const SizedBox.shrink();
  }
}

class _OfflineStrip extends StatelessWidget {
  const _OfflineStrip();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Semantics(
      liveRegion: true,
      // Material, because this is mounted by `MaterialApp.builder` — above any
      // Scaffold — and Text needs one to resolve its style.
      child: Material(
        color: AppColors.warning,
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: <Widget>[
                const Icon(
                  Icons.wifi_off_rounded,
                  size: 16,
                  color: Colors.white,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    "You're offline — showing saved information.",
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A one-line explanation for a control that needs the network.
///
/// P0-12 asks for actions to be "disabled with a reason, not silently failing".
/// Pair it with a disabled button rather than letting the tap produce a
/// timeout the customer has to interpret.
class OfflineActionNotice extends StatelessWidget {
  const OfflineActionNotice({
    super.key,
    this.message = 'Needs a connection. Reconnect to continue.',
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Icon(
          Icons.cloud_off_rounded,
          size: 16,
          color: theme.colorScheme.outline,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            message,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ),
      ],
    );
  }
}
