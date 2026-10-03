import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/features/engagement/data/push_registrar.dart';
import 'package:optex_mobile/features/engagement/domain/notification_category.dart';

import 'support/fake_http.dart';

/// SPEC-11 B-1: the app's half of push registration.
///
/// What matters is what goes over the wire — the API only honours a mute it is
/// told about, and only ever sends to a device that registered — and that no
/// failure here can break the app: push is an optimisation over SMS.
ApiPushRegistrar _registrar(
  CapturingAdapter adapter, {
  bool signedIn = true,
  String? platform = 'android',
  String? version = '1.0.0+3',
}) => ApiPushRegistrar(
  api: apiClientWith(adapter),
  isSignedIn: () => signedIn,
  platform: () => platform,
  appVersion: () async => version,
);

const String _token = 'fcm-token-abcdefghijklmnopqrstuvwxyz';

void main() {
  group('register', () {
    test(
      'POSTs the device to /devices with its platform and mute set',
      () async {
        final CapturingAdapter adapter = CapturingAdapter();

        await _registrar(adapter).register(
          token: _token,
          mutedCategories: <NotificationCategory>{NotificationCategory.offer},
        );

        expect(adapter.only.method, 'POST');
        expect(adapter.only.path, '/devices');
        expect(adapter.only.data, <String, dynamic>{
          'token': _token,
          'platform': 'android',
          'appVersion': '1.0.0+3',
          'mutedCategories': <String>['offer'],
        });
      },
    );

    test('sends the platform it is told it is on', () async {
      final CapturingAdapter adapter = CapturingAdapter();
      await _registrar(
        adapter,
        platform: 'ios',
      ).register(token: _token, mutedCategories: <NotificationCategory>{});
      expect((adapter.only.data as Map<String, dynamic>)['platform'], 'ios');
    });

    test('sends an empty mute set as an empty list, so an un-mute is carried too', () async {
      // Sending nothing would leave the server holding the OLD set: unmuting a
      // category has to be said, not implied.
      final CapturingAdapter adapter = CapturingAdapter();
      await _registrar(adapter)
          .register(token: _token, mutedCategories: <NotificationCategory>{});
      expect(
        (adapter.only.data as Map<String, dynamic>)['mutedCategories'],
        isEmpty,
      );
    });

    test(
      'serialises a mute set in a fixed order, whatever order it was built in',
      () async {
        final CapturingAdapter a = CapturingAdapter();
        final CapturingAdapter b = CapturingAdapter();

        await _registrar(a).register(
          token: _token,
          mutedCategories: <NotificationCategory>{
            NotificationCategory.offer,
            NotificationCategory.order,
          },
        );
        await _registrar(b).register(
          token: _token,
          mutedCategories: <NotificationCategory>{
            NotificationCategory.order,
            NotificationCategory.offer,
          },
        );

        expect(
          (a.only.data as Map<String, dynamic>)['mutedCategories'],
          <String>['order', 'offer'],
        );
        expect(
          (b.only.data as Map<String, dynamic>)['mutedCategories'],
          <String>['order', 'offer'],
        );
      },
    );

    test('registers even when the app version cannot be read', () async {
      final CapturingAdapter adapter = CapturingAdapter();
      await _registrar(
        adapter,
        version: null,
      ).register(token: _token, mutedCategories: <NotificationCategory>{});
      final Map<String, dynamic> body =
          adapter.only.data as Map<String, dynamic>;
      expect(body.containsKey('appVersion'), isFalse);
      expect(body['token'], _token);
    });

    test(
      'says nothing while signed out — the sign-in path registers instead',
      () async {
        final CapturingAdapter adapter = CapturingAdapter();
        final ApiPushRegistrar registrar = _registrar(adapter, signedIn: false);

        await registrar.register(
          token: _token,
          mutedCategories: <NotificationCategory>{},
        );

        expect(adapter.requests, isEmpty);
        // ...but it remembers the token, so the diagnostics row still has one.
        expect(registrar.lastToken, _token);
      },
    );

    test('says nothing on a platform with nowhere to push to', () async {
      final CapturingAdapter adapter = CapturingAdapter();
      await _registrar(
        adapter,
        platform: null,
      ).register(token: _token, mutedCategories: <NotificationCategory>{});
      expect(adapter.requests, isEmpty);
    });

    test('remembers the token and mute set for the diagnostics row', () async {
      final ApiPushRegistrar registrar = _registrar(CapturingAdapter());
      await registrar.register(
        token: _token,
        mutedCategories: <NotificationCategory>{
          NotificationCategory.appointment,
        },
      );
      expect(registrar.lastToken, _token);
      expect(registrar.lastMutedCategories, <NotificationCategory>{
        NotificationCategory.appointment,
      });
    });

    // Push is an optimisation over the SMS that goes out alongside every
    // notification, and `PushService._onTokenRefresh` does not guard this call.
    // None of these may throw.
    for (final int status in <int>[400, 401, 404, 500, 503]) {
      test('does not throw when the server answers $status', () async {
        final CapturingAdapter adapter = CapturingAdapter(status: status);
        await expectLater(
          _registrar(
            adapter,
          ).register(token: _token, mutedCategories: <NotificationCategory>{}),
          completes,
        );
      });
    }

    test('does not throw when the network is down', () async {
      final CapturingAdapter adapter = CapturingAdapter(networkError: true);
      await expectLater(
        _registrar(adapter)
            .register(token: _token, mutedCategories: <NotificationCategory>{}),
        completes,
      );
    });
  });

  group('deregister', () {
    test(
      'POSTs the token to /devices/deregister — in the body, never the URL',
      () async {
        final CapturingAdapter adapter = CapturingAdapter();

        await _registrar(adapter).deregister(token: _token);

        expect(adapter.only.method, 'POST');
        expect(adapter.only.path, '/devices/deregister');
        expect(adapter.only.data, <String, dynamic>{'token': _token});
        // Request URLs are written to access logs; a token is a credential for
        // notifying this handset.
        expect(adapter.only.uri.toString(), isNot(contains(_token)));
      },
    );

    test('forgets the token locally', () async {
      final ApiPushRegistrar registrar = _registrar(CapturingAdapter());
      await registrar.register(
        token: _token,
        mutedCategories: <NotificationCategory>{},
      );
      await registrar.deregister(token: _token);
      expect(registrar.lastToken, isNull);
    });

    test(
      'says nothing while signed out, and on a platform with no push',
      () async {
        final CapturingAdapter signedOut = CapturingAdapter();
        await _registrar(signedOut, signedIn: false).deregister(token: _token);
        expect(signedOut.requests, isEmpty);

        final CapturingAdapter desktop = CapturingAdapter();
        await _registrar(desktop, platform: null).deregister(token: _token);
        expect(desktop.requests, isEmpty);
      },
    );

    test(
      'does not throw when it cannot reach the server — sign-out must go ahead',
      () async {
        await expectLater(
          _registrar(CapturingAdapter(networkError: true))
              .deregister(token: _token),
          completes,
        );
        await expectLater(
          _registrar(CapturingAdapter(status: 500)).deregister(token: _token),
          completes,
        );
      },
    );
  });
}
