import 'package:dio/dio.dart';

/// Supplies and renews credentials for [AuthInterceptor].
///
/// An interface rather than a direct dependency on `AuthRepository`, because
/// the repository itself calls the API — wiring them directly would be a cycle.
abstract class TokenProvider {
  /// The current access token, or null when signed out.
  String? get accessToken;

  /// Exchanges the stored refresh token for a new session.
  ///
  /// Returns the new access token, or null when the refresh token is revoked or
  /// expired — which the interceptor treats as a hard sign-out.
  Future<String?> refresh();

  /// Called when refresh fails, so the app can drop to a signed-out state.
  Future<void> onSessionExpired();
}

/// Attaches the bearer token and transparently renews it on 401.
///
/// The single-flight guard is the point of this class. Several screens
/// commonly fire requests at once (list + badge count + profile); without it a
/// stale token produces N parallel refreshes, N rotated refresh tokens, and —
/// because Supabase rotates on every use — a race where all but one are
/// invalidated and the user is bounced to login despite holding a valid
/// session. SPEC-11 P0-1 makes this an explicit acceptance criterion.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._tokens, this._retryClient);

  final TokenProvider _tokens;

  /// A Dio instance WITHOUT this interceptor, used to replay the original
  /// request. Replaying through the main client would re-enter the interceptor
  /// and can loop indefinitely on a server that always answers 401.
  final Dio _retryClient;

  Future<String?>? _inFlight;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (options.extra['skipAuth'] != true) {
      final String? token = _tokens.accessToken;
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = err.requestOptions;

    final bool shouldAttempt =
        err.response?.statusCode == 401 &&
        request.extra['skipAuth'] != true &&
        request.extra['didRetry'] != true;

    if (!shouldAttempt) {
      handler.next(err);
      return;
    }

    // The token this request actually used. If it no longer matches the current
    // one, a concurrent request already refreshed — replay immediately instead
    // of burning another rotation.
    final String? usedToken = _stripBearer(request.headers['Authorization']);
    final String? current = _tokens.accessToken;

    String? freshToken;
    if (current != null && current.isNotEmpty && current != usedToken) {
      freshToken = current;
    } else {
      freshToken = await _refreshOnce();
    }

    if (freshToken == null || freshToken.isEmpty) {
      await _tokens.onSessionExpired();
      handler.next(err);
      return;
    }

    try {
      final Response<dynamic> replayed = await _replay(request, freshToken);
      handler.resolve(replayed);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Collapses concurrent refreshes into one network call. Every caller awaits
  /// the same future; the slot is released in `whenComplete` so a later 401
  /// starts a fresh attempt rather than reusing a settled result.
  Future<String?> _refreshOnce() {
    return _inFlight ??= _tokens.refresh().whenComplete(() {
      _inFlight = null;
    });
  }

  Future<Response<dynamic>> _replay(RequestOptions request, String token) {
    return _retryClient.fetch<dynamic>(
      request.copyWith(
        data: _replayableBody(request.data),
        headers: <String, dynamic>{
          ...request.headers,
          'Authorization': 'Bearer $token',
        },
        extra: <String, dynamic>{...request.extra, 'didRetry': true},
      ),
    );
  }

  /// Returns a body that can be sent a second time.
  ///
  /// A `FormData` finalises its multipart stream when it is sent, so replaying
  /// the same instance throws `StateError` instead of retrying — which would
  /// turn a routine token refresh into a failed prescription upload, on the one
  /// screen where the customer has just spent a minute photographing a
  /// document. `clone()` rebuilds the parts from their sources.
  ///
  /// A file part backed by a stream rather than a path cannot be re-read, so
  /// clone() is not a universal guarantee; uploads in this app are file- and
  /// bytes-backed, which clone handles.
  static dynamic _replayableBody(dynamic data) {
    if (data is FormData) {
      return data.isFinalized ? data.clone() : data;
    }
    return data;
  }

  static String? _stripBearer(dynamic header) {
    if (header is! String) return null;
    final List<String> parts = header.split(' ');
    return parts.length == 2 ? parts[1] : null;
  }
}
