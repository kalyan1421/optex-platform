import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../data/notifications_repository.dart';
import '../data/offline_cache.dart';
import '../domain/app_notification.dart';
import '../domain/notification_category.dart';
import 'engagement_providers.dart';

/// The category chip currently selected, or null for "All".
class NotificationFilterController extends Notifier<NotificationCategory?> {
  @override
  NotificationCategory? build() => null;

  void select(NotificationCategory? category) => state = category;
}

final NotifierProvider<NotificationFilterController, NotificationCategory?>
notificationFilterProvider =
    NotifierProvider<NotificationFilterController, NotificationCategory?>(
      NotificationFilterController.new,
    );

/// The notification centre's feed (SPEC-11 P0-11).
///
/// Backed by a real API — `GET /notifications` — so unlike push this is
/// complete, not a stub. Page 1 of each category is mirrored into the offline
/// cache and served back, clearly labelled, when the network is down.
class NotificationsFeedController extends AsyncNotifier<NotificationFeed> {
  static const int _pageSize = 20;

  /// How long a cached page is served as if it were fresh. Short, because the
  /// read state it carries changes on other devices too. Nothing price-bearing
  /// is cached here, so this age never reaches checkout.
  static const Duration cacheMaxAge = Duration(minutes: 15);

  NotificationsRepository get _repository =>
      ref.read(notificationsRepositoryProvider);
  OfflineCache get _cache => ref.read(offlineCacheProvider);

  @override
  Future<NotificationFeed> build() async {
    final NotificationCategory? category = ref.watch(
      notificationFilterProvider,
    );
    return _loadFirstPage(category);
  }

  static String cacheKeyFor(NotificationCategory? category) =>
      'notifications:v1:${category?.wire ?? 'all'}:page1';

  Future<NotificationFeed> _loadFirstPage(
    NotificationCategory? category,
  ) async {
    try {
      final NotificationFeed feed = await _repository.list(
        category: category,
        pageSize: _pageSize,
      );
      unawaited(_cache.write(cacheKeyFor(category), _encode(feed)));
      return feed;
    } on ApiException catch (error) {
      if (!error.isNetwork) rethrow;

      // Offline. A saved copy, labelled as such, beats an error screen on a
      // list the customer has already read once.
      final CachedDocument? cached = await _cache.readStale(
        cacheKeyFor(category),
      );
      if (cached == null) rethrow;

      final NotificationFeed feed = NotificationsRepository.feedFromJson(
        cached.value,
      );
      return NotificationFeed(
        items: feed.items,
        total: feed.total,
        page: feed.page,
        pageSize: feed.pageSize,
        servedFromCache: true,
        cacheAge: cached.age,
      );
    }
  }

  Map<String, dynamic> _encode(NotificationFeed feed) => <String, dynamic>{
    'data': feed.items.map((AppNotification n) => n.toJson()).toList(),
    'total': feed.total,
    'page': feed.page,
    'pageSize': feed.pageSize,
  };

  Future<void> refresh() async {
    final NotificationCategory? category = ref.read(notificationFilterProvider);
    state = await AsyncValue.guard(() => _loadFirstPage(category));
  }

  /// Appends the next page. A no-op while one is in flight, at the end of the
  /// list, or when the current page came from the cache — paging a cached page
  /// would interleave saved and live rows.
  Future<void> loadMore() async {
    final NotificationFeed? current = state.value;
    if (current == null) return;
    if (current.loadingMore || !current.hasMore || current.servedFromCache) {
      return;
    }

    state = AsyncValue<NotificationFeed>.data(
      current.copyWith(loadingMore: true),
    );

    try {
      final NotificationFeed next = await _repository.list(
        category: ref.read(notificationFilterProvider),
        page: current.page + 1,
        pageSize: current.pageSize,
      );
      final List<AppNotification> merged = <AppNotification>[
        ...current.items,
        ...next.items,
      ];
      state = AsyncValue<NotificationFeed>.data(
        current.copyWith(
          items: merged,
          // A page that comes back empty ends the feed, whatever `total`
          // claims. `hasMore` is `items.length < total`, so trusting a stale
          // or over-counted total against an empty page leaves the list
          // asking for page N+1 forever behind a footer spinner. The orders
          // and catalog feeds already clamp this; this one did not.
          total: next.items.isEmpty ? merged.length : next.total,
          page: next.page,
          loadingMore: false,
        ),
      );
    } on ApiException {
      // Keep what is on screen; the row the customer was reading does not
      // vanish because page 3 failed.
      state = AsyncValue<NotificationFeed>.data(
        current.copyWith(loadingMore: false),
      );
      rethrow;
    }
  }

  /// Marks one read, optimistically. Idempotent server-side, so a double tap
  /// is harmless.
  Future<void> markRead(String id) async {
    final NotificationFeed? current = state.value;
    if (current == null) return;

    final AppNotification? target = current.items
        .where((AppNotification n) => n.id == id)
        .firstOrNull;
    if (target == null || !target.isUnread) return;

    _replace(current, id, target.markedRead(DateTime.now()));
    ref.read(unreadCountProvider.notifier).adjust(-1);

    try {
      await _repository.markRead(id);
      unawaited(_invalidateCache());
    } on ApiException {
      // Put it back: a row that silently un-reads itself on the next refresh is
      // more confusing than one that never changed.
      _replace(current, id, target);
      ref.read(unreadCountProvider.notifier).adjust(1);
      rethrow;
    }
  }

  Future<void> markAllRead() async {
    final NotificationFeed? current = state.value;
    if (current == null) return;

    final DateTime now = DateTime.now();
    final List<AppNotification> optimistic = current.items
        .map((AppNotification n) => n.isUnread ? n.markedRead(now) : n)
        .toList();

    state = AsyncValue<NotificationFeed>.data(
      current.copyWith(items: optimistic),
    );
    ref.read(unreadCountProvider.notifier).setCount(0);

    try {
      await _repository.markAllRead();
      unawaited(_invalidateCache());
    } on ApiException {
      state = AsyncValue<NotificationFeed>.data(current);
      await ref.read(unreadCountProvider.notifier).reload();
      rethrow;
    }
  }

  void _replace(NotificationFeed feed, String id, AppNotification replacement) {
    state = AsyncValue<NotificationFeed>.data(
      feed.copyWith(
        items: feed.items
            .map((AppNotification n) => n.id == id ? replacement : n)
            .toList(),
      ),
    );
  }

  /// Read state changed, so every cached page for this customer is now wrong.
  Future<void> _invalidateCache() => _cache.invalidatePrefix('notifications:');
}

final AsyncNotifierProvider<NotificationsFeedController, NotificationFeed>
notificationsFeedProvider =
    AsyncNotifierProvider<NotificationsFeedController, NotificationFeed>(
      NotificationsFeedController.new,
    );

/// The badge count, from `GET /notifications/unread-count`.
class UnreadCountController extends AsyncNotifier<int> {
  @override
  Future<int> build() =>
      ref.watch(notificationsRepositoryProvider).unreadCount();

  /// Refetches. Called on foreground (P0-11) and after a reconnect.
  Future<void> reload() async {
    state = await AsyncValue.guard(
      () => ref.read(notificationsRepositoryProvider).unreadCount(),
    );
  }

  /// Optimistic local adjustment, clamped at zero.
  void adjust(int delta) {
    final int? current = state.value;
    if (current == null) return;
    final int next = current + delta;
    state = AsyncValue<int>.data(next < 0 ? 0 : next);
  }

  void setCount(int value) =>
      state = AsyncValue<int>.data(value < 0 ? 0 : value);
}

final AsyncNotifierProvider<UnreadCountController, int> unreadCountProvider =
    AsyncNotifierProvider<UnreadCountController, int>(
      UnreadCountController.new,
    );
