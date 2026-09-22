import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth/auth_models.dart';
import 'auth/auth_repository.dart';
import 'auth/session_manager.dart';
import 'network/api_client.dart';
import 'storage/secure_store.dart';

/// The shared object graph. Feature code depends on these, never on
/// constructors, so tests can override any layer.
///
/// Wiring order matters and is enforced by the graph itself:
/// SecureStore -> SessionManager -> ApiClient -> AuthRepository, with the
/// repository's refresh function injected back into the session manager by
/// [bootstrapAuth].
final Provider<SecureStore> secureStoreProvider = Provider<SecureStore>(
  (Ref ref) => SecureStore(),
);

final Provider<SessionManager> sessionManagerProvider =
    Provider<SessionManager>(
      (Ref ref) => SessionManager(ref.watch(secureStoreProvider)),
    );

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>(
  (Ref ref) => ApiClient(tokens: ref.watch(sessionManagerProvider)),
);

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>(
      (Ref ref) => AuthRepository(ref.watch(apiClientProvider)),
    );

/// Lets a feature run teardown when the user signs out, without core having to
/// import that feature.
///
/// Cached documents, notification tokens and the like are per-customer, and on
/// a shared handset leaving them behind is a real leak rather than an untidiness.
/// Features register here; [AuthController.logout] runs them.
class SessionCleanupRegistry {
  final List<Future<void> Function()> _callbacks = <Future<void> Function()>[];

  void register(Future<void> Function() callback) => _callbacks.add(callback);

  /// Runs every hook, isolating failures. One feature's broken teardown must
  /// not leave the user signed in.
  Future<void> runAll() async {
    for (final Future<void> Function() cb in _callbacks) {
      try {
        await cb();
      } catch (_) {
        // Deliberately swallowed — see above.
      }
    }
  }
}

final Provider<SessionCleanupRegistry> sessionCleanupProvider =
    Provider<SessionCleanupRegistry>((Ref ref) => SessionCleanupRegistry());

/// Where the app is in its sign-in lifecycle.
///
/// [unknown] exists so the router can hold on a splash instead of flashing the
/// login screen while a stored session is being restored.
enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({required this.status, this.user});

  final AuthStatus status;
  final AuthUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolved => status != AuthStatus.unknown;

  static const AuthState unknown = AuthState(status: AuthStatus.unknown);
  static const AuthState signedOut = AuthState(
    status: AuthStatus.unauthenticated,
  );
}

/// Owns sign-in state for the whole app. The router listens to it.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() => AuthState.unknown;

  SessionManager get _session => ref.read(sessionManagerProvider);
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Restores a persisted session at startup.
  ///
  /// A failure to fetch the profile is NOT treated as signed-out: the token may
  /// be fine and the network merely down, and dumping a user to login because
  /// their bus went through a tunnel is the wrong call. Only a rejected token
  /// (handled by the interceptor) signs them out.
  Future<void> restore() async {
    final bool had = await _session.restore();
    if (!had) {
      state = AuthState.signedOut;
      return;
    }
    try {
      final AuthUser user = await _repo.me();
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      state = _session.hasSession
          ? const AuthState(status: AuthStatus.authenticated)
          : AuthState.signedOut;
    }
  }

  Future<void> _adopt(AuthSession session) async {
    await _session.adopt(session);
    try {
      final AuthUser user = await _repo.me();
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      state = const AuthState(status: AuthStatus.authenticated);
    }
  }

  Future<AuthResult> login(String email, String password) async {
    final AuthResult result = await _repo.login(
      email: email,
      password: password,
    );
    if (result.session != null) await _adopt(result.session!);
    return result;
  }

  Future<AuthResult> signup(
    String email,
    String password,
    String fullName,
  ) async {
    final AuthResult result = await _repo.signup(
      email: email,
      password: password,
      fullName: fullName,
    );
    if (result.session != null) await _adopt(result.session!);
    return result;
  }

  /// Returns false when the user dismissed the provider sheet — the caller
  /// should do nothing, not show an error.
  Future<bool> signInWithGoogle() async {
    final AuthSession? session = await _repo.signInWithGoogle();
    if (session == null) return false;
    await _adopt(session);
    return true;
  }

  Future<bool> signInWithApple() async {
    final AuthSession? session = await _repo.signInWithApple();
    if (session == null) return false;
    await _adopt(session);
    return true;
  }

  Future<void> logout() async {
    await _repo.logout();
    await ref.read(sessionCleanupProvider).runAll();
    await _session.clear();
    state = AuthState.signedOut;
  }

  /// Re-fetches the profile into [AuthState].
  ///
  /// Needed because a name edited on the profile screen otherwise never reaches
  /// the rest of the app — `AuthState.user` would keep serving the value loaded
  /// at sign-in. Deliberately silent on failure: a stale name is a far better
  /// outcome than signing someone out because a refresh call timed out.
  Future<void> refreshUser() async {
    if (!state.isAuthenticated) return;
    try {
      final AuthUser user = await _repo.me();
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      // Keep the existing state.
    }
  }

  /// Requests a password-reset email.
  ///
  /// NOTE: the reset link always points at the **web** app. `resetRedirectUrl`
  /// in `auth-flow.service.ts` builds it from the server-side `WEB_APP_URL` and
  /// deliberately refuses a client-supplied value (an open-redirect guard), so
  /// a mobile user finishes the reset in a browser. Tracked as B-6 in SPEC-11.
  Future<void> requestPasswordReset(String email) =>
      _repo.requestPasswordReset(email);

  /// Called by the interceptor when a refresh is rejected.
  void markSignedOut() => state = AuthState.signedOut;
}

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Connects the session manager's refresh hook to the repository, closing the
/// loop the graph deliberately left open. Call once at startup.
///
/// Takes the [ProviderContainer] rather than a `Ref` because it runs in `main`,
/// before any widget — and therefore any `Ref` — exists.
Future<void> bootstrapAuth(ProviderContainer container) async {
  final SessionManager session = container.read(sessionManagerProvider);
  final AuthRepository repo = container.read(authRepositoryProvider);

  session.refresher = repo.refresh;
  session.onExpired = () async =>
      container.read(authControllerProvider.notifier).markSignedOut();

  await container.read(apiClientProvider).attachClientVersion();
  await container.read(authControllerProvider.notifier).restore();
}
