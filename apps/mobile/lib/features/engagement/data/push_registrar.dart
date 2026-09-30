import 'dart:developer' as developer;

import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/notification_category.dart';

/// Tells the server which handset to send this customer's notifications to.
abstract class PushRegistrar {
  /// Called after a token is minted, on every rotation, and whenever the mute
  /// set changes. Idempotent on the server, so calling it again is always safe.
  Future<void> register({
    required String token,
    required Set<NotificationCategory> mutedCategories,
  });

  /// Called on sign-out, so the next person to use the handset does not receive
  /// the previous customer's order updates.
  Future<void> deregister({required String token});
}

/// The real registrar: `POST /devices` and `POST /devices/deregister`
/// (SPEC-11 B-1, `apps/api/src/modules/push`).
///
/// **The mute set travels with the token.** That is what makes the opt-out
/// "honoured server-side" (P0-10): the API never sends a muted category to this
/// device, rather than sending it and relying on the app to hide it.
///
/// **A failure never propagates.** Push is an optimisation over the SMS that
/// goes out alongside every notification, so a registration that could not reach
/// the server costs nothing worse than a missed push. The next cold start, the
/// next sign-in and the next preference change all register again.
///
/// **Signed out means silent.** Registering is an authenticated call and a token
/// belongs to whoever is signed in, so with no session there is nothing to say —
/// the sign-in path registers instead (`PushController` rebuilds on it). Calling
/// the API anyway would just be a 401 that tries to refresh a session that is not
/// there.
class ApiPushRegistrar implements PushRegistrar {
  ApiPushRegistrar({
    required this._api,
    required this._isSignedIn,
    String? Function()? platform,
    Future<String?> Function()? appVersion,
  }) : _platform = platform ?? _devicePlatform,
       _appVersion = appVersion ?? _packageVersion;

  final ApiClient _api;
  final bool Function() _isSignedIn;

  /// `ios`, `android`, or null where there is nothing to push to (a desktop dev
  /// run). Injectable so a test does not depend on the host it runs on.
  final String? Function() _platform;
  final Future<String?> Function() _appVersion;

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

    final String? platform = _platform();
    if (platform == null || !_isSignedIn()) return;

    try {
      final String? version = await _appVersion();
      await _api.post<dynamic>(
        '/devices',
        body: <String, dynamic>{
          'token': token,
          'platform': platform,
          'appVersion': ?version,
          // In enum order, so the same set always serialises the same way.
          'mutedCategories': <String>[
            for (final NotificationCategory c in NotificationCategory.values)
              if (mutedCategories.contains(c)) c.wire,
          ],
        },
      );
    } on ApiException catch (error) {
      developer.log(
        'Push registration failed (will retry on next start, sign-in or '
        'preference change): ${error.message}',
        name: 'optex.engagement',
      );
    }
  }

  @override
  Future<void> deregister({required String token}) async {
    _lastToken = null;

    if (_platform() == null || !_isSignedIn()) return;

    try {
      // A POST with the token in the body rather than a DELETE with it in the
      // path: request URLs end up in access logs, and a token is a credential
      // for notifying this handset.
      await _api.post<dynamic>(
        '/devices/deregister',
        body: <String, dynamic>{'token': token},
      );
    } on ApiException catch (error) {
      // The FCM token is also deleted locally by `PushService.disable`, which
      // kills it at Google's end too — so a deregister that could not land does
      // not leave a live token behind, only a row the server will disable the
      // first time it tries to send to it.
      developer.log(
        'Push deregistration failed: ${error.message}',
        name: 'optex.engagement',
      );
    }
  }

  static String? _devicePlatform() {
    final String channel = clientChannelFor(defaultTargetPlatform);
    return channel == 'other' ? null : channel;
  }

  static Future<String?> _packageVersion() async {
    try {
      final PackageInfo info = await PackageInfo.fromPlatform();
      return '${info.version}+${info.buildNumber}';
    } catch (_) {
      // Informational only — never a reason not to register.
      return null;
    }
  }
}
