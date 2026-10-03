import 'dart:async';
import 'dart:developer' as developer;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'engagement_providers.dart';
import 'notifications_providers.dart';

enum ConnectivityStatus {
  /// Before the first answer from the platform. Treated as online: a banner
  /// shown on a guess is worse than a banner shown a beat late.
  unknown,
  online,
  offline,
}

/// Watches the radio and invalidates the offline cache on reconnect.
///
/// P0-12 requires the cache to invalidate on reconnect. Doing it here rather
/// than per-screen means a slice that adopts [OfflineCache] later inherits the
/// behaviour for free.
class ConnectivityController extends Notifier<ConnectivityStatus> {
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _disposed = false;

  @override
  ConnectivityStatus build() {
    _disposed = false;
    final Connectivity connectivity = Connectivity();

    _subscription?.cancel();
    _subscription = connectivity.onConnectivityChanged.listen(
      _apply,
      onError: (Object error) => developer.log(
        'Connectivity stream error: $error',
        name: 'optex.engagement',
      ),
    );

    ref.onDispose(() {
      _disposed = true;
      _subscription?.cancel();
      _subscription = null;
    });

    unawaited(_seed(connectivity));
    return ConnectivityStatus.unknown;
  }

  Future<void> _seed(Connectivity connectivity) async {
    try {
      _apply(await connectivity.checkConnectivity());
    } catch (error) {
      developer.log(
        'Initial connectivity check failed: $error',
        name: 'optex.engagement',
      );
    }
  }

  void _apply(List<ConnectivityResult> results) {
    if (_disposed) return;

    // `connectivity_plus` reports interfaces, not reachability: `wifi` means a
    // radio is associated, not that the API answers. Treated as "probably
    // online" — the request itself is still the authority, and `ApiException`
    // already distinguishes a network failure.
    final bool online =
        results.isNotEmpty &&
        results.any((ConnectivityResult r) => r != ConnectivityResult.none);

    final ConnectivityStatus next = online
        ? ConnectivityStatus.online
        : ConnectivityStatus.offline;
    if (next == state) return;

    final ConnectivityStatus previous = state;
    state = next;

    if (previous == ConnectivityStatus.offline &&
        next == ConnectivityStatus.online) {
      unawaited(_onReconnect());
    }
  }

  Future<void> _onReconnect() async {
    if (_disposed) return;
    // Deliberately NOT clear(). On the flaky connectivity this cache exists
    // for, brief drops are constant, and wiping everything on each recovery
    // meant it never accumulated anything useful. It was redundant too:
    // OfflineCache.read takes a mandatory maxAge and drops expired entries as
    // it reads, and the invalidations below already force fresh fetches. This
    // is housekeeping only.
    await ref.read(offlineCacheProvider).purgeExpired(const Duration(days: 7));
    if (_disposed) return;
    ref.invalidate(notificationsFeedProvider);
    ref.invalidate(unreadCountProvider);
  }
}

final NotifierProvider<ConnectivityController, ConnectivityStatus>
connectivityProvider =
    NotifierProvider<ConnectivityController, ConnectivityStatus>(
      ConnectivityController.new,
    );

/// True unless we know we are offline.
final Provider<bool> isOfflineProvider = Provider<bool>(
  (Ref ref) => ref.watch(connectivityProvider) == ConnectivityStatus.offline,
);
