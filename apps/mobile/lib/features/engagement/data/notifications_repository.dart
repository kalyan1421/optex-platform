import '../../../core/network/api_client.dart';
import '../domain/app_notification.dart';
import '../domain/notification_category.dart';

/// The customer's own notification feed.
///
/// Wraps `apps/api/src/modules/customer-notifications/` — four routes, all
/// JWT-scoped to the caller's own `customers` row, no special permission:
///   GET    /notifications                 (category, unreadOnly, page, pageSize)
///   GET    /notifications/unread-count
///   PATCH  /notifications/:id/read        (idempotent)
///   POST   /notifications/read-all
///
/// Paths are relative to `/api`, which `ApiClient` already carries in its base
/// URL, and auth is automatic.
class NotificationsRepository {
  const NotificationsRepository(this._api);

  final ApiClient _api;

  static const String _base = '/notifications';

  Future<NotificationFeed> list({
    NotificationCategory? category,
    bool unreadOnly = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      _base,
      query: <String, dynamic>{
        'category': category?.wire,
        // Sent only when true: the DTO's `@IsBoolean()` is fine with absent,
        // and an explicit `false` would just be noise on the wire.
        'unreadOnly': unreadOnly ? true : null,
        'page': page,
        'pageSize': pageSize,
      },
    );

    return feedFromJson(json);
  }

  /// Exposed so the offline cache can rehydrate a page it stored verbatim.
  static NotificationFeed feedFromJson(Map<String, dynamic> json) {
    final Object? rawItems = json['data'];
    final List<AppNotification> items = rawItems is List
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(AppNotification.fromJson)
            .toList()
        : <AppNotification>[];

    return NotificationFeed(
      items: items,
      total: (json['total'] as num?)?.toInt() ?? items.length,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
    );
  }

  Future<int> unreadCount() async {
    final Map<String, dynamic> json =
        await _api.get<Map<String, dynamic>>('$_base/unread-count');
    return (json['count'] as num?)?.toInt() ?? 0;
  }

  Future<AppNotification> markRead(String id) async {
    final Map<String, dynamic> json =
        await _api.patch<Map<String, dynamic>>('$_base/$id/read');
    return AppNotification.fromJson(json);
  }

  /// Returns how many rows actually changed.
  Future<int> markAllRead() async {
    final Map<String, dynamic> json =
        await _api.post<Map<String, dynamic>>('$_base/read-all');
    return (json['count'] as num?)?.toInt() ?? 0;
  }
}
