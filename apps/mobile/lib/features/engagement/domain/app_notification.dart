import 'notification_category.dart';

/// One row of the customer's notification feed.
///
/// Mirrors `NotificationView` in
/// `apps/api/src/modules/customer-notifications/customer-notifications.service.ts`:
/// `{ id, category, title, body, link, readAt, createdAt }`.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.categoryWire,
    required this.title,
    required this.body,
    required this.createdAt,
    this.link,
    this.readAt,
  });

  final String id;

  /// Kept as the raw wire value so an unrecognised category survives a
  /// cache round-trip instead of being normalised away.
  final String categoryWire;

  final String title;
  final String body;

  /// A server-authored in-app path such as `/orders/{id}/tracking`,
  /// `/appointments` or `/shop`. Resolved by `DeepLinks.resolve`.
  final String? link;

  final DateTime? readAt;
  final DateTime createdAt;

  NotificationCategory? get category =>
      NotificationCategory.tryParse(categoryWire);

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String? ?? '',
        categoryWire: json['category'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        link: json['link'] as String?,
        readAt: _parseDate(json['readAt']),
        createdAt: _parseDate(json['createdAt']) ?? DateTime.now(),
      );

  /// Round-trips through the offline cache. Deliberately the same key names as
  /// the API so a cached page and a fresh page parse identically.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'category': categoryWire,
    'title': title,
    'body': body,
    'link': link,
    'readAt': readAt?.toUtc().toIso8601String(),
    'createdAt': createdAt.toUtc().toIso8601String(),
  };

  AppNotification markedRead(DateTime at) => AppNotification(
    id: id,
    categoryWire: categoryWire,
    title: title,
    body: body,
    link: link,
    readAt: at,
    createdAt: createdAt,
  );

  static DateTime? _parseDate(Object? value) =>
      value is String ? DateTime.tryParse(value)?.toLocal() : null;
}

/// A page of the feed, plus the paging cursor the UI needs to ask for more.
class NotificationFeed {
  const NotificationFeed({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    this.loadingMore = false,
    this.servedFromCache = false,
    this.cacheAge,
  });

  final List<AppNotification> items;
  final int total;
  final int page;
  final int pageSize;
  final bool loadingMore;

  /// True when the network failed and the page came from the offline cache.
  /// The UI says so rather than passing stale data off as live.
  final bool servedFromCache;
  final Duration? cacheAge;

  bool get hasMore => items.length < total;

  static const NotificationFeed empty = NotificationFeed(
    items: <AppNotification>[],
    total: 0,
    page: 1,
    pageSize: 20,
  );

  NotificationFeed copyWith({
    List<AppNotification>? items,
    int? total,
    int? page,
    bool? loadingMore,
  }) => NotificationFeed(
    items: items ?? this.items,
    total: total ?? this.total,
    page: page ?? this.page,
    pageSize: pageSize,
    loadingMore: loadingMore ?? this.loadingMore,
    servedFromCache: servedFromCache,
    cacheAge: cacheAge,
  );
}
