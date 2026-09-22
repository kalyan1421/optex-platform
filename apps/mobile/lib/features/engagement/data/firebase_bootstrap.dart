import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_core/firebase_core.dart';

/// Initialises Firebase **without ever being able to break startup.**
///
/// There is no `google-services.json` and no `GoogleService-Info.plist` in this
/// repo — they are blocked on SPEC-11 Q1/Q2 (the Apple and Google accounts, and
/// who owns the Firebase project). Until those land, `Firebase.initializeApp()`
/// throws on both platforms, and on a plain `flutter test` host it throws
/// `MissingPluginException` instead.
///
/// So every caller asks this class, gets a bool, and the two Firebase-dependent
/// features — push (P0-10) and the Remote Config version gate (P0-14) — simply
/// do not run when it is false. The app is fully usable without either: nothing
/// here is on the path to browsing, checkout, or the notification centre, which
/// is backed by the OPTEX API rather than Firebase.
///
/// The result is memoised. A missing config file is a property of the binary,
/// not a transient fault, so retrying it on every check would cost a timeout
/// per attempt and never succeed.
class FirebaseBootstrap {
  const FirebaseBootstrap._();

  static Future<bool>? _attempt;
  static bool _available = false;
  static Object? _lastError;

  /// Whether a previous [ensureInitialized] succeeded. False before the first
  /// call, so callers should await that rather than reading this cold.
  static bool get isAvailable => _available;

  /// The error that made initialisation fail, for the diagnostics row on the
  /// settings screen. Null when Firebase is up or has not been tried.
  static Object? get lastError => _lastError;

  static Future<bool> ensureInitialized() => _attempt ??= _initialize();

  static Future<bool> _initialize() async {
    try {
      if (Firebase.apps.isNotEmpty) {
        _available = true;
        return true;
      }
      await Firebase.initializeApp().timeout(const Duration(seconds: 10));
      _available = true;
      _lastError = null;
      return true;
    } catch (error) {
      // Deliberately catching everything: FirebaseException for a bad or absent
      // options file, MissingPluginException off-device, TimeoutException if the
      // platform channel never answers. None of them is worth a crash.
      _available = false;
      _lastError = error;
      developer.log(
        'Firebase unavailable — push and the version gate are disabled for '
        'this launch. This is expected until SPEC-11 Q1/Q2 land the config '
        'files. ($error)',
        name: 'optex.engagement',
      );
      return false;
    }
  }

  /// Test-only reset, so a suite can exercise both the available and the
  /// unavailable path in one process.
  static void resetForTesting() {
    _attempt = null;
    _available = false;
    _lastError = null;
  }
}
