import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/features/engagement/domain/notification_category.dart';
import 'package:optex_mobile/features/engagement/domain/push_payload.dart';

/// SPEC-11 B-1: the push payload contract, pinned from the app's side.
///
/// The API builds these exact `data` blocks in
/// `apps/api/src/modules/push/fcm-message.ts` and asserts them in
/// `test/unit/fcm-message.spec.ts`. The maps below are copied from what that
/// builder produces, so a key renamed on either side fails a test here or there
/// rather than quietly turning every tap into "opens the notification centre".
///
/// If you change one of these, change the other.
const String _orderId = '11111111-2222-3333-4444-555555555555';

void main() {
  group('the data block the API sends', () {
    test('an order update deep-links to that order’s tracking', () {
      final PushPayload p = PushPayload.fromData(<String, dynamic>{
        'category': 'order',
        'link': '/orders/$_orderId/tracking',
        'notificationId': 'nid-1',
      });

      expect(p.category, NotificationCategory.order);
      expect(p.notificationId, 'nid-1');
      expect(p.route, '/orders/$_orderId/tracking');
    });

    test('an appointment reminder opens appointments', () {
      final PushPayload p = PushPayload.fromData(<String, dynamic>{
        'category': 'appointment',
        'link': '/appointments',
      });

      expect(p.category, NotificationCategory.appointment);
      expect(p.route, '/appointments');
    });

    test(
      'an offer opens the shop, or wherever the promotion points in-app',
      () {
        final PushPayload shop = PushPayload.fromData(<String, dynamic>{
          'category': 'offer',
          'link': '/shop',
        });
        expect(shop.category, NotificationCategory.offer);
        expect(shop.route, '/shop');
      },
    );

    test('a message with no link still parses, and falls back to the notification centre', () {
      // The API omits `link` (and `notificationId`) rather than sending "null".
      final PushPayload p = PushPayload.fromData(<String, dynamic>{
        'category': 'offer',
      });

      expect(p.category, NotificationCategory.offer);
      expect(p.route, isNull);
    });
  });

  group('degrades rather than crashes', () {
    test(
      'an offer pointing at a web page has no in-app route — it does not 404',
      () {
        // `promo_banners.target_url` can be an http(s) marketing page with no
        // in-app equivalent. Silently rewriting it into a route that does not
        // exist would land the customer on the error screen.
        final PushPayload p = PushPayload.fromData(<String, dynamic>{
          'category': 'offer',
          'link': 'https://optexopticians.co.ke/summer-sale',
        });
        expect(p.route, isNull);
      },
    );

    test('an unrecognised category is kept as null, not thrown on', () {
      final PushPayload p = PushPayload.fromData(<String, dynamic>{
        'category': 'loyalty',
        'link': '/shop',
      });
      expect(p.category, isNull);
      // Still routable: losing a delivery because the server grew a category
      // is worse than showing it with a generic treatment.
      expect(p.route, '/shop');
    });

    test('empty and non-string values are ignored', () {
      final PushPayload p = PushPayload.fromData(<String, dynamic>{
        'category': '',
        'link': '   ',
        'notificationId': 42,
      });
      expect(p.category, isNull);
      expect(p.link, isNull);
      expect(p.notificationId, isNull);
    });

    test('survives an empty data block', () {
      final PushPayload p = PushPayload.fromData(<String, dynamic>{});
      expect(p.route, isNull);
    });
  });

  group('a foreground message re-posted as a local notification', () {
    test('keeps the route through encode and decode', () {
      // `flutter_local_notifications` carries a single opaque string, so the tap
      // on a foreground notification round-trips through this.
      final PushPayload original = PushPayload.fromData(<String, dynamic>{
        'category': 'order',
        'link': '/orders/$_orderId/tracking',
        'notificationId': 'nid-9',
      });

      final PushPayload? back = PushPayload.decode(original.encode());

      expect(back?.route, '/orders/$_orderId/tracking');
      expect(back?.category, NotificationCategory.order);
      expect(back?.notificationId, 'nid-9');
    });
  });
}
