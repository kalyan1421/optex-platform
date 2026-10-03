import 'dart:convert';

import 'deep_link.dart';
import 'notification_category.dart';

/// The data block the app expects on an FCM message.
///
/// **This is an agreed contract, pinned from both sides.** The API builds these
/// exact keys in `apps/api/src/modules/push/fcm-message.ts` (`buildFcmMessage`,
/// asserted by `test/unit/fcm-message.spec.ts`), and
/// `test/push_payload_contract_test.dart` here feeds this class that same data
/// block — so a key renamed on either side fails a test instead of quietly
/// degrading every tap to "opens the notification centre". Every field is still
/// optional on purpose: an unrecognised message must degrade, not crash.
///
/// All values are strings (FCM data payloads are string-to-string). What the
/// server sends today:
///   category       `order` | `appointment` | `offer`   (always)
///   link           an in-app path, e.g. `/orders/{id}/tracking`
///   notificationId the `customer_notifications.id` this push mirrors
///
/// The remaining keys are not sent yet but are understood if they ever are:
///   orderId, appointmentId, productSlug  — when the sender gives ids, not a link
class PushPayload {
  const PushPayload({
    this.category,
    this.link,
    this.orderId,
    this.appointmentId,
    this.productSlug,
    this.notificationId,
    this.title,
    this.body,
  });

  final NotificationCategory? category;
  final String? link;
  final String? orderId;
  final String? appointmentId;
  final String? productSlug;
  final String? notificationId;
  final String? title;
  final String? body;

  factory PushPayload.fromData(Map<String, dynamic> data) => PushPayload(
    category: NotificationCategory.tryParse(_str(data['category'])),
    link: _str(data['link']),
    orderId: _str(data['orderId']) ?? _str(data['order_id']),
    appointmentId: _str(data['appointmentId']) ?? _str(data['appointment_id']),
    productSlug: _str(data['productSlug']) ?? _str(data['product_slug']),
    notificationId:
        _str(data['notificationId']) ?? _str(data['notification_id']),
    title: _str(data['title']),
    body: _str(data['body']),
  );

  /// Re-parses what [encode] wrote. Used when a tap arrives through
  /// `flutter_local_notifications`, which carries a single opaque string.
  static PushPayload? decode(String? payload) {
    if (payload == null || payload.isEmpty) return null;
    try {
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) return PushPayload.fromData(decoded);
    } on FormatException {
      // A payload we did not write. Fall through to null; the tap still opens
      // the notification centre.
    }
    return null;
  }

  String encode() => jsonEncode(<String, dynamic>{
    if (category != null) 'category': category!.wire,
    if (link != null) 'link': link,
    if (orderId != null) 'orderId': orderId,
    if (appointmentId != null) 'appointmentId': appointmentId,
    if (productSlug != null) 'productSlug': productSlug,
    if (notificationId != null) 'notificationId': notificationId,
  });

  /// Where tapping this notification should land, or null to fall back to the
  /// notification centre.
  String? get route =>
      DeepLinks.resolve(link) ??
      DeepLinks.forEntity(
        orderId: orderId,
        appointmentId: appointmentId,
        productSlug: productSlug,
      );

  static String? _str(Object? value) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    return null;
  }
}
