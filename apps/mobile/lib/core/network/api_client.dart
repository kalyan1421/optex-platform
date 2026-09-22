import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../env/app_env.dart';
import 'api_exception.dart';
import 'auth_interceptor.dart';

/// The single HTTP entry point to the OPTEX API.
///
/// Every feature goes through this class. It owns base URL, timeouts, auth,
/// the client-version header and error normalisation, so no feature has to
/// reimplement them — and so there is one place to change when the contract
/// moves (SPEC-11 §9).
class ApiClient {
  ApiClient({required TokenProvider tokens}) {
    final BaseOptions options = BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(
        seconds: 60,
      ), // generous: prescription uploads
      headers: <String, dynamic>{'Accept': 'application/json'},
      // Let non-2xx through to the interceptor chain rather than throwing
      // before AuthInterceptor gets a chance to refresh on 401.
      validateStatus: (int? status) => status != null && status < 400,
    );

    _retryClient = Dio(options);
    _dio = Dio(options);
    _dio.interceptors.add(AuthInterceptor(tokens, _retryClient));
  }

  late final Dio _dio;
  late final Dio _retryClient;

  Dio get raw => _dio;

  /// Stamps every request with the client version, per SPEC-11 §9.
  ///
  /// This is what makes a future breaking change surviveable: we can read the
  /// live version spread from API logs *before* deciding whether to force an
  /// upgrade, rather than guessing. Called once at startup.
  Future<void> attachClientVersion() async {
    try {
      final PackageInfo info = await PackageInfo.fromPlatform();
      final String header = '${info.version}+${info.buildNumber}';
      for (final Dio client in <Dio>[_dio, _retryClient]) {
        client.options.headers['X-Optex-Client'] = 'flutter';
        client.options.headers['X-Optex-Client-Version'] = header;
      }
    } catch (_) {
      // Telemetry only — never block startup because version lookup failed.
    }
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    bool auth = true,
  }) => _send<T>(
    () =>
        _dio.get<T>(path, queryParameters: _clean(query), options: _opts(auth)),
  );

  Future<T> post<T>(String path, {Object? body, bool auth = true}) =>
      _send<T>(() => _dio.post<T>(path, data: body, options: _opts(auth)));

  Future<T> patch<T>(String path, {Object? body, bool auth = true}) =>
      _send<T>(() => _dio.patch<T>(path, data: body, options: _opts(auth)));

  Future<T> delete<T>(String path, {Object? body, bool auth = true}) =>
      _send<T>(() => _dio.delete<T>(path, data: body, options: _opts(auth)));

  Future<T> upload<T>(
    String path, {
    required FormData form,
    void Function(int sent, int total)? onProgress,
  }) => _send<T>(
    () => _dio.post<T>(
      path,
      data: form,
      onSendProgress: onProgress,
      options: _opts(true),
    ),
  );

  Options _opts(bool auth) =>
      Options(extra: <String, dynamic>{if (!auth) 'skipAuth': true});

  /// Drops null query values. Dio serialises them as empty strings, which the
  /// API's `ValidationPipe` rejects as present-but-invalid rather than absent —
  /// an easy way to turn an optional filter into a 400.
  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final Map<String, dynamic> out = <String, dynamic>{};
    query.forEach((String k, dynamic v) {
      if (v != null) out[k] = v;
    });
    return out.isEmpty ? null : out;
  }

  Future<T> _send<T>(Future<Response<T>> Function() request) async {
    try {
      final Response<T> res = await request();
      return res.data as T;
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
