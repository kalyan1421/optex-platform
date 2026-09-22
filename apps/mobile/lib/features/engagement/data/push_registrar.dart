import 'dart:developer' as developer;

import '../domain/notification_category.dart';

/// The seam where device-token registration will plug in.
///
/// **There is no server to call.** A grep for `fcm`, `apns`, `device_token` and
/// `firebase` across `apps/api/src`, all 41 migrations and `packages/` returns
/// zero hits: no `device_tokens` table, no register/deregister route, no sender
/// service. That is SPEC-11 §8 item **B-1**, and it is backend work, not
/// something this slice can fix.
///
/// So this is an interface with a no-op implementation rather than a call to an
/// invented endpoint. A plausible-looking `POST /devices` against a route that
/// does not exist would compile, pass review, and fail silently in production
/// against a 404 — which is strictly worse than an obvious stub, because it
/// looks finished.
abstract class PushRegistrar {
  /// Called after a token is minted and on every rotation.
  Future<void> register({
    required String token,
    required Set<NotificationCategory> mutedCategories,
  });

  /// Called on sign-out, so the next person to use the handset does not receive
  /// the previous customer's order updates.
  Future<void> deregister({required String token});
}

/// The implementation in force today: records the token locally so the settings
/// screen can prove the client half works, and calls nothing.
class UnregisteredPushRegistrar implements PushRegistrar {
  UnregisteredPushRegistrar();

  String? _lastToken;
  Set<NotificationCategory> _lastMuted = <NotificationCategory>{};

  /// The most recent FCM token, for the diagnostics row on the settings screen.
  String? get lastToken => _lastToken;

  Set<NotificationCategory> get lastMutedCategories => _lastMuted;

  @override
  Future<void> register({
    required String token,
    required Set<NotificationCategory> mutedCategories,
  }) async {
    _lastToken = token;
    _lastMuted = mutedCategories;

    // TODO(B-1): replace this log with the real call once the backend lands.
    // Expected to become roughly:
    //     await _api.post<void>('/devices', body: {
    //       'token': token,
    //       'platform': Platform.isIOS ? 'ios' : 'android',
    //       'mutedCategories': mutedCategories.map((c) => c.wire).toList(),
    //     });
    // Do not write that call until the route exists — see SPEC-11 §8 B-1.
    developer.log(
      'Push token acquired but not registered: no backend endpoint exists '
      '(SPEC-11 §8, B-1). token=${_redact(token)} '
      'muted=${mutedCategories.map((NotificationCategory c) => c.wire).toList()}',
      name: 'optex.engagement',
    );
  }

  @override
  Future<void> deregister({required String token}) async {
    _lastToken = null;

    // TODO(B-1): becomes `await _api.delete<void>('/devices/$token')` — or
    // whatever shape B-1 settles on — once the route exists.
    developer.log(
      'Push token discarded locally; nothing to deregister server-side '
      '(SPEC-11 §8, B-1). token=${_redact(token)}',
      name: 'optex.engagement',
    );
  }

  /// A token is a credential for sending this device notifications, so only
  /// enough of it is logged to correlate two log lines.
  static String _redact(String token) =>
      token.length <= 12 ? '***' : '${token.substring(0, 6)}…${token.substring(token.length - 4)}';
}
