import '../network/auth_interceptor.dart';
import '../storage/secure_store.dart';
import 'auth_models.dart';

/// Holds the live session and implements [TokenProvider] for the HTTP layer.
///
/// Deliberately separate from `AuthController`. The dependency chain is
/// `ApiClient -> TokenProvider` and `AuthRepository -> ApiClient`, so if the
/// controller implemented [TokenProvider] directly the graph would be circular.
/// This object breaks the cycle: it is constructed first with no dependencies,
/// and the refresh behaviour is injected once the repository exists.
class SessionManager implements TokenProvider {
  SessionManager(this._store);

  final SecureStore _store;

  String? _accessToken;
  String? _refreshToken;

  /// Injected after construction — see the class comment.
  Future<AuthSession?> Function(String refreshToken)? refresher;

  /// Injected after construction. Called when a refresh is rejected, so the app
  /// can drop to a signed-out state and route to login.
  Future<void> Function()? onExpired;

  @override
  String? get accessToken => _accessToken;

  bool get hasSession => _accessToken != null && _accessToken!.isNotEmpty;

  /// Loads a persisted session at startup. Returns true when one was found.
  Future<bool> restore() async {
    _accessToken = await _store.readAccessToken();
    _refreshToken = await _store.readRefreshToken();
    return hasSession;
  }

  Future<void> adopt(AuthSession session) async {
    _accessToken = session.accessToken;
    _refreshToken = session.refreshToken;
    await _store.saveSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
  }

  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    await _store.clear();
  }

  @override
  Future<String?> refresh() async {
    final String? token = _refreshToken;
    final Future<AuthSession?> Function(String)? fn = refresher;
    if (token == null || token.isEmpty || fn == null) return null;

    final AuthSession? session = await fn(token);
    if (session == null) return null;

    await adopt(session);
    return session.accessToken;
  }

  @override
  Future<void> onSessionExpired() async {
    await clear();
    await onExpired?.call();
  }
}
