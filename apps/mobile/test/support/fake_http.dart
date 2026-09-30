import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:optex_mobile/core/network/api_client.dart';
import 'package:optex_mobile/core/network/auth_interceptor.dart';

/// A [TokenProvider] for a signed-out client — enough to build an [ApiClient].
class NoTokens implements TokenProvider {
  @override
  String? get accessToken => null;
  @override
  Future<String?> refresh() async => null;
  @override
  Future<void> onSessionExpired() async {}
}

/// Records every request an [ApiClient] makes and answers each with [status].
///
/// Sits at the bottom of Dio's stack, so what it captures is what would have
/// gone on the wire: headers, path and the body as the caller passed it.
class CapturingAdapter implements HttpClientAdapter {
  CapturingAdapter({this.status = 200, this.networkError = false});

  /// The status every request is answered with.
  int status;

  /// When true, every request fails as a dropped connection would.
  bool networkError;

  final List<RequestOptions> requests = <RequestOptions>[];

  RequestOptions get only => requests.single;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (networkError) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'test: network down',
      );
    }
    return ResponseBody.fromString(
      jsonEncode(
        status >= 400
            ? <String, dynamic>{'message': 'nope'}
            : <String, dynamic>{},
      ),
      status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// An [ApiClient] whose traffic goes to [adapter].
ApiClient apiClientWith(CapturingAdapter adapter) {
  final ApiClient client = ApiClient(tokens: NoTokens());
  client.raw.httpClientAdapter = adapter;
  return client;
}
