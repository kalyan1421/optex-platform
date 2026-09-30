import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/core/network/api_client.dart';

import 'support/fake_http.dart';

/// SPEC-11 B-2: the API attributes an order to `X-Optex-Client`, and recognises
/// exactly `ios` and `android`. If the app sends anything else, in-app orders
/// are silently counted as web and the headline goal (G1) reads as zero.
///
/// So the assertion that matters is not the mapping function alone but what
/// actually goes out on a request.

Future<RequestOptions> _oneRequestOn(TargetPlatform platform) async {
  debugDefaultTargetPlatformOverride = platform;
  final CapturingAdapter adapter = CapturingAdapter();
  await apiClientWith(adapter).get<dynamic>('/products', auth: false);
  return adapter.only;
}

void main() {
  tearDown(() => debugDefaultTargetPlatformOverride = null);

  group('clientChannelFor', () {
    test('names the platform, not the framework', () {
      expect(clientChannelFor(TargetPlatform.iOS), 'ios');
      expect(clientChannelFor(TargetPlatform.android), 'android');
    });

    test('anything else is "other", which the API counts as web', () {
      for (final TargetPlatform p in <TargetPlatform>[
        TargetPlatform.macOS,
        TargetPlatform.windows,
        TargetPlatform.linux,
        TargetPlatform.fuchsia,
      ]) {
        expect(clientChannelFor(p), 'other');
      }
    });
  });

  group('the header on the wire', () {
    test('an iOS build sends X-Optex-Client: ios', () async {
      final RequestOptions sent = await _oneRequestOn(TargetPlatform.iOS);
      expect(sent.headers['X-Optex-Client'], 'ios');
    });

    test('an Android build sends X-Optex-Client: android', () async {
      final RequestOptions sent = await _oneRequestOn(TargetPlatform.android);
      expect(sent.headers['X-Optex-Client'], 'android');
    });

    test('the channel is on the very first request, before any version '
        'lookup has run', () async {
      // `attachClientVersion` awaits package info and can fail. Attribution must
      // not ride on it: the channel is known synchronously.
      final RequestOptions sent = await _oneRequestOn(TargetPlatform.android);
      expect(sent.headers.containsKey('X-Optex-Client'), isTrue);
      expect(sent.headers.containsKey('X-Optex-Client-Version'), isFalse);
    });
  });
}
