import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Token storage, backed by the Keychain on iOS and EncryptedSharedPreferences
/// on Android.
///
/// Per SPEC-11 P0-1 there is deliberately **no plaintext fallback**. If the
/// platform store is unavailable (a rooted device, a locked Keychain), reads
/// return null and writes are dropped, so the session degrades to in-memory for
/// that launch rather than leaving credentials readable on disk.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              // v11 encrypts on Android by default (AES-GCM under an RSA-OAEP
              // wrapped key, API 23+), so the old `encryptedSharedPreferences`
              // flag is gone and the defaults are already the strong path.
              aOptions: AndroidOptions(),
              // `first_unlock` rather than `unlocked`: a push handler or a
              // background refresh can run while the device is locked, and
              // `unlocked` would make the token unreadable exactly then.
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  final FlutterSecureStorage _storage;

  static const String _kAccessToken = 'optex.access_token';
  static const String _kRefreshToken = 'optex.refresh_token';

  Future<String?> readAccessToken() => _read(_kAccessToken);
  Future<String?> readRefreshToken() => _read(_kRefreshToken);

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _write(_kAccessToken, accessToken);
    await _write(_kRefreshToken, refreshToken);
  }

  /// Clears both tokens. Called on sign-out and whenever a refresh is rejected.
  ///
  /// Failures are swallowed on purpose: a clear that throws must not leave the
  /// app believing it is still signed in. The in-memory state is reset by the
  /// caller regardless of what the platform store does.
  Future<void> clear() async {
    try {
      await _storage.delete(key: _kAccessToken);
      await _storage.delete(key: _kRefreshToken);
    } catch (_) {
      // Intentionally ignored — see above.
    }
  }

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (_) {
      // Degrade to in-memory rather than falling back to plaintext.
    }
  }
}
