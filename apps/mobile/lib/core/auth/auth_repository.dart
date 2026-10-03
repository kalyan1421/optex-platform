import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import '../env/app_env.dart';
import '../network/api_client.dart';
import '../network/api_exception.dart';
import 'auth_models.dart';

/// All authentication, for every provider.
///
/// Email/password goes through the OPTEX API's auth proxy. Google and Apple go
/// through Supabase's `signInWithIdToken`, because the provider handshake has
/// to happen on-device — but the result is the *same Supabase session* either
/// way, so everything downstream (the bearer token, `/auth/refresh`, RLS,
/// `app_metadata`) is identical regardless of how the user signed in.
///
/// This is why SPEC-11 P0-1 chose Supabase's native Google provider over
/// Firebase Auth: one identity, one JWT issuer, one refresh path.
class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  sb.GoTrueClient get _goTrue => sb.Supabase.instance.client.auth;

  // ── Email / password ────────────────────────────────────────────────────

  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/auth/login',
      body: <String, dynamic>{'email': email.trim(), 'password': password},
      auth: false,
    );
    return AuthResult.fromJson(json);
  }

  Future<AuthResult> signup({
    required String email,
    required String password,
    required String fullName,
  }) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/auth/signup',
      body: <String, dynamic>{
        'email': email.trim(),
        'password': password,
        'fullName': fullName.trim(),
      },
      auth: false,
    );
    return AuthResult.fromJson(json);
  }

  Future<void> requestPasswordReset(String email) => _api.post<dynamic>(
    '/auth/forgot-password',
    body: <String, dynamic>{'email': email.trim()},
    auth: false,
  );

  // ── Session lifecycle ───────────────────────────────────────────────────

  /// Exchanges a refresh token for a new session.
  ///
  /// The first consumer `POST /auth/refresh` has ever had — it was built for
  /// the web and never wired up (see docs/API-MIGRATION-PLAN.md §4).
  Future<AuthSession?> refresh(String refreshToken) async {
    try {
      final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
        '/auth/refresh',
        body: <String, dynamic>{'refreshToken': refreshToken},
        auth: false,
      );
      return AuthResult.fromJson(json).session;
    } on ApiException {
      // A rejected refresh is a normal end-of-session, not an error worth
      // surfacing. The caller signs the user out.
      return null;
    }
  }

  Future<AuthUser> me() async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/auth/me',
    );
    return AuthUser.fromJson(json);
  }

  /// Revokes the session server-side. Best-effort: the caller clears local
  /// storage regardless, because a network failure here must never leave the
  /// user apparently signed in.
  Future<void> logout() async {
    try {
      await _api.post<dynamic>('/auth/logout');
    } on ApiException {
      // Intentionally ignored — see above.
    }
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Not signed in with Google, or plugin unavailable.
    }
  }

  // ── Google ──────────────────────────────────────────────────────────────

  bool _googleInitialized = false;

  /// Google Sign-In, via Supabase's native Google provider.
  ///
  /// Returns null when the user dismisses the account sheet — a cancellation is
  /// not a failure and must not surface as an error (SPEC-11 P0-1).
  Future<AuthSession?> signInWithGoogle() async {
    if (!AppEnv.googleSignInConfigured) {
      // BLOCKED ON Q1/Q2: no Google Cloud project exists yet, so no OAuth
      // client IDs have been issued. Failing loudly here beats a null-pointer
      // from inside the plugin.
      throw const ApiException(
        message: 'Google Sign-In is not configured for this build.',
      );
    }

    final GoogleSignIn google = GoogleSignIn.instance;
    if (!_googleInitialized) {
      await google.initialize(
        serverClientId: AppEnv.googleServerClientId,
        clientId: AppEnv.googleIosClientId.isEmpty
            ? null
            : AppEnv.googleIosClientId,
      );
      _googleInitialized = true;
    }

    if (!google.supportsAuthenticate()) {
      throw const ApiException(
        message: 'Google Sign-In is not supported on this device.',
      );
    }

    final GoogleSignInAccount account;
    try {
      account = await google.authenticate();
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      throw ApiException(message: 'Google Sign-In failed: ${e.code.name}');
    }

    final String? idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const ApiException(
        message: 'Google did not return an identity token. Please try again.',
      );
    }

    final sb.AuthResponse res = await _goTrue.signInWithIdToken(
      provider: sb.OAuthProvider.google,
      idToken: idToken,
    );
    return _sessionFrom(res, 'Google');
  }

  // ── Apple ───────────────────────────────────────────────────────────────

  /// Sign in with Apple.
  ///
  /// Mandatory on iOS because the app offers Google: App Store Review
  /// Guideline 4.8 only exempts apps that *exclusively* use their own account
  /// system (SPEC-11 P0-1).
  ///
  /// The nonce is not ceremony. Apple receives the SHA-256 hash and Supabase
  /// receives the raw value; Supabase rehashes and compares. Without it, a
  /// stolen identity token could be replayed against our backend.
  Future<AuthSession?> signInWithApple() async {
    final String rawNonce = _generateNonce();
    final String hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();

    final AuthorizationCredentialAppleID credential;
    try {
      credential = await SignInWithApple.getAppleIDCredential(
        scopes: <AppleIDAuthorizationScopes>[
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) return null;
      throw ApiException(message: 'Sign in with Apple failed: ${e.message}');
    }

    final String? idToken = credential.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw const ApiException(
        message: 'Apple did not return an identity token. Please try again.',
      );
    }

    final sb.AuthResponse res = await _goTrue.signInWithIdToken(
      provider: sb.OAuthProvider.apple,
      idToken: idToken,
      nonce: rawNonce,
    );

    // Apple returns the user's name only on the very first authorization, and
    // never again. If we do not capture it now it is gone for good, so patch it
    // onto the profile immediately.
    final String? given = credential.givenName;
    final String? family = credential.familyName;
    final String full = <String?>[
      given,
      family,
    ].whereType<String>().join(' ').trim();
    if (full.isNotEmpty) {
      try {
        await _goTrue.updateUser(
          sb.UserAttributes(data: <String, dynamic>{'full_name': full}),
        );
      } catch (_) {
        // Non-fatal: the account exists, it is just nameless.
      }
    }

    return _sessionFrom(res, 'Apple');
  }

  AuthSession _sessionFrom(sb.AuthResponse res, String provider) {
    final sb.Session? session = res.session;
    if (session == null) {
      throw ApiException(
        message: '$provider sign-in did not return a session.',
      );
    }
    return AuthSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? '',
      expiresIn: session.expiresIn ?? 3600,
    );
  }

  static String _generateNonce([int length = 32]) {
    const String chars =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    final Random rng = Random.secure();
    return List<String>.generate(
      length,
      (_) => chars[rng.nextInt(chars.length)],
    ).join();
  }
}
