import 'package:dio/dio.dart';

/// A failure from the OPTEX API, normalised into something the UI can render.
///
/// The API returns NestJS's standard error envelope, where `message` is either
/// a string or an array of validation strings. Feature code should show
/// [message] directly: it is written server-side and is already customer-safe.
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.code,
    this.isNetwork = false,
  });

  final String message;
  final int? statusCode;
  final String? code;
  final bool isNetwork;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;

  /// True when retrying might plausibly succeed. Drives "Try again" affordances.
  bool get isRetryable => isNetwork || (statusCode != null && statusCode! >= 500);

  factory ApiException.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(
          message: 'The connection timed out. Check your network and try again.',
          isNetwork: true,
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          message: "Can't reach OPTEX. Check your internet connection.",
          isNetwork: true,
        );
      case DioExceptionType.cancel:
        return const ApiException(message: 'Request cancelled.');
      default:
        break;
    }

    final Response<dynamic>? res = e.response;
    return ApiException(
      message: _extractMessage(res?.data) ?? 'Something went wrong. Please try again.',
      statusCode: res?.statusCode,
      code: res?.data is Map ? (res!.data as Map)['error'] as String? : null,
    );
  }

  /// NestJS sends `message` as a string for thrown exceptions and as a string
  /// array for `ValidationPipe` failures. Both reach the user as one line.
  static String? _extractMessage(dynamic data) {
    if (data is Map) {
      final dynamic m = data['message'] ?? data['error'];
      if (m is String && m.trim().isNotEmpty) return m;
      if (m is List && m.isNotEmpty) return m.map((e) => e.toString()).join('\n');
    }
    if (data is String && data.trim().isNotEmpty && data.length < 300) return data;
    return null;
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}
