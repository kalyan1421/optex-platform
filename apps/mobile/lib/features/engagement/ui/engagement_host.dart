import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/providers.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/router/routes.dart';
import '../domain/version_gate.dart';
import '../state/connectivity_providers.dart';
import '../state/engagement_providers.dart';
import '../state/notifications_providers.dart';
import '../state/push_providers.dart';
import '../state/version_gate_providers.dart';
import 'widgets/offline_banner.dart';
import 'widgets/version_gate_views.dart';

/// The single integration point for everything in this slice that is not a
/// route.
///
/// Wrap the app with it:
///
/// ```dart
/// MaterialApp.router(
///   routerConfig: router,
///   builder: (BuildContext context, Widget? child) =>
///       EngagementHost(child: child ?? const SizedBox.shrink()),
/// )
/// ```
///
/// It provides:
///   * the persistent offline banner (P0-12) — the only place it is mounted, so
///     screens never double it up;
///   * the unread badge refresh on foreground (P0-11);
///   * the version gate on cold start and on foreground after > 1h idle, never
///     mid-checkout (P0-14);
///   * push listener attachment, which is also what picks up a notification tap
///     that launched the app from terminated (P0-10).
///
/// One widget rather than four, so the integrator has one line to add and the
/// lifecycle listener that three of them need exists exactly once.
class EngagementHost extends ConsumerStatefulWidget {
  const EngagementHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<EngagementHost> createState() => _EngagementHostState();
}

class _EngagementHostState extends ConsumerState<EngagementHost> {
  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onResume: _onResume);

    // Sign-out teardown. Cached documents and the push token are per-customer,
    // so on a shared handset leaving them behind is a leak, not untidiness.
    // Registered through core's registry so the dependency still points
    // feature -> core, never the reverse.
    ref.read(sessionCleanupProvider).register(() async {
      await ref.read(pushControllerProvider.notifier).disable();
      await ref.read(offlineCacheProvider).clear();
    });

    // After the first frame: the router is mounted by then, so a cold-start
    // deep link has somewhere to land and the gate can read the location.
    WidgetsBinding.instance.addPostFrameCallback((_) => _onColdStart());
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    _lifecycle = null;
    super.dispose();
  }

  void _onColdStart() {
    if (!mounted) return;

    // Attaching push listeners is what picks up a notification tap that
    // launched the app from terminated (`getInitialMessage`). It never prompts
    // for permission — see PushController.build.
    unawaited(ref.read(pushControllerProvider.future));

    // Starts the connectivity subscription so the banner is live from launch.
    ref.read(connectivityProvider);

    unawaited(
      ref
          .read(versionGateProvider.notifier)
          .checkOnStart(currentLocation: _currentLocation()),
    );
  }

  void _onResume() {
    if (!mounted) return;

    // P0-11: badge count refreshed on foreground.
    unawaited(ref.read(unreadCountProvider.notifier).reload());

    // P0-14: foreground check, throttled to > 1h idle inside the controller.
    unawaited(
      ref
          .read(versionGateProvider.notifier)
          .checkOnForeground(currentLocation: _currentLocation()),
    );

    // Housekeeping, so the offline store does not accumulate a tail of
    // documents nobody will read again.
    unawaited(
      ref.read(offlineCacheProvider).purgeExpired(const Duration(days: 7)),
    );
  }

  /// The current route.
  ///
  /// Read from the router instance rather than `GoRouter.of(context)`: this
  /// widget is mounted by `MaterialApp.builder`, which sits *above* the
  /// `Router`, so there is no `InheritedGoRouter` overhead.
  String? _currentLocation() {
    try {
      return ref.read(routerProvider).state.uri.toString();
    } catch (_) {
      // `state` throws before any route has matched.
      return null;
    }
  }

  static bool _isCheckout(String? location) =>
      location != null &&
      (location == Routes.checkout ||
          location.startsWith('${Routes.checkout}/'));

  @override
  Widget build(BuildContext context) {
    final VersionGateDecision? gate = ref.watch(versionGateProvider);
    final bool offline = ref.watch(isOfflineProvider);

    // A hard block replaces the app outright. Nothing underneath should be
    // reachable, including by gesture.
    if (gate?.blocks ?? false) {
      return UnsupportedVersionScreen(decision: gate!);
    }

    // The banner takes layout space rather than floating over the app bar, so
    // it can never hide a title or a back button. The child's top inset is
    // removed while it is showing, because the banner has already drawn it.
    final Widget content = offline
        ? MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: widget.child,
          )
        : widget.child;

    return Column(
      // Stretch, so the banner spans the width rather than shrinking to its
      // text.
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const OfflineBanner(),
        Expanded(
          child: Stack(
            children: <Widget>[
              Positioned.fill(child: content),
              if (gate?.nudges ?? false)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: _SoftPrompt(decision: gate!),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The dismissible update prompt, hidden while the customer is in checkout.
///
/// Rebuilt from the router delegate so entering checkout after the prompt was
/// raised hides it, rather than only suppressing the check that raised it.
class _SoftPrompt extends ConsumerWidget {
  const _SoftPrompt({required this.decision});

  final VersionGateDecision decision;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(routerProvider);

    return ListenableBuilder(
      listenable: router.routerDelegate,
      builder: (BuildContext context, Widget? _) {
        String? location;
        try {
          location = router.state.uri.toString();
        } catch (_) {
          location = null;
        }
        if (_EngagementHostState._isCheckout(location)) {
          return const SizedBox.shrink();
        }

        return Material(
          color: Colors.transparent,
          child: UpdatePromptCard(
            decision: decision,
            onDismiss: () => ref.read(versionGateProvider.notifier).dismiss(),
          ),
        );
      },
    );
  }
}
