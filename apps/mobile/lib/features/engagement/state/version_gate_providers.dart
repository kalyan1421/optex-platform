import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/routes.dart';
import '../data/version_gate_repository.dart';
import '../domain/version_gate.dart';

final Provider<VersionGateRepository> versionGateRepositoryProvider =
    Provider<VersionGateRepository>((Ref ref) => VersionGateRepository());

/// Runs the P0-14 check and holds whatever should be shown, or null for
/// "nothing to say" — which is also every failure mode.
///
/// The rules this encodes, all from P0-14:
///   * fails open — an unreachable or slow Remote Config leaves state null;
///   * the minimum is never hardcoded — it comes from the served config or
///     nowhere;
///   * soft prompt at most once per 72h, persisted across launches;
///   * cold start, and foreground after > 1h idle;
///   * never mid-checkout.
class VersionGateController extends Notifier<VersionGateDecision?> {
  /// P0-14's foreground cadence.
  static const Duration foregroundIdleThreshold = Duration(hours: 1);

  bool _inFlight = false;

  @override
  VersionGateDecision? build() => null;

  VersionGateRepository get _repository =>
      ref.read(versionGateRepositoryProvider);

  /// Cold start.
  Future<void> checkOnStart({String? currentLocation}) =>
      _check(currentLocation: currentLocation, requireIdle: false);

  /// Resume. Only actually checks when the last check was more than an hour ago.
  Future<void> checkOnForeground({String? currentLocation}) =>
      _check(currentLocation: currentLocation, requireIdle: true);

  /// Dismisses the soft prompt for this launch. The 72h cooldown was already
  /// persisted when the prompt was raised, so dismissing does not need to write
  /// anything — and a customer who force-quits instead of tapping "Later" is
  /// still not re-nagged.
  void dismiss() {
    if (state?.blocks ?? false) return; // A hard block is not dismissible.
    state = null;
  }

  Future<void> _check({
    required String? currentLocation,
    required bool requireIdle,
  }) async {
    if (_inFlight) return;
    if (_isCheckoutLocation(currentLocation)) return;

    _inFlight = true;
    try {
      if (requireIdle) {
        final DateTime? last = await _repository.lastCheckAt();
        if (last != null &&
            DateTime.now().difference(last) < foregroundIdleThreshold) {
          return;
        }
      }

      final SemanticVersion? installed = await _repository.installedVersion();
      if (installed == null) return; // Cannot compare; say nothing.

      final VersionGateConfig? config = await _repository.fetchConfig();
      unawaited(_repository.recordCheck());
      if (config == null) return; // Fail open.

      final VersionGateDecision decision = VersionGateDecision.evaluate(
        installed: installed,
        config: config,
      );

      switch (decision.status) {
        case VersionGateStatus.current:
          state = null;
        case VersionGateStatus.updateAvailable:
          if (await _repository.softPromptIsDue()) {
            await _repository.recordSoftPrompt();
            state = decision;
          }
        case VersionGateStatus.unsupported:
          state = decision;
      }
    } finally {
      _inFlight = false;
    }
  }

  /// P0-14: never mid-checkout. Interrupting a payment to talk about an app
  /// update is how an abandoned cart happens.
  static bool _isCheckoutLocation(String? location) {
    if (location == null) return false;
    return location == Routes.checkout ||
        location.startsWith('${Routes.checkout}/');
  }
}

final NotifierProvider<VersionGateController, VersionGateDecision?>
versionGateProvider =
    NotifierProvider<VersionGateController, VersionGateDecision?>(
      VersionGateController.new,
    );
