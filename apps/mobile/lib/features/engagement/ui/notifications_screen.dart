import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/app_notification.dart';
import '../domain/deep_link.dart';
import '../domain/notification_category.dart';
import '../state/connectivity_providers.dart';
import '../state/notifications_providers.dart';
import 'widgets/category_filter_bar.dart';
import 'widgets/notification_tile.dart';
import 'widgets/offline_banner.dart';

/// The in-app notification centre (SPEC-11 P0-11).
///
/// Fully backed by `apps/api/src/modules/customer-notifications/`: list with a
/// category filter, mark-one-read, mark-all-read, and tap-to-deep-link. The
/// badge count lives in `unreadCountProvider` so the app bar and this screen
/// agree without either owning the other.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final bool nearBottom =
        _scroll.position.pixels >= _scroll.position.maxScrollExtent - 320;
    if (nearBottom) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    try {
      await ref.read(notificationsFeedProvider.notifier).loadMore();
    } on ApiException catch (error) {
      _toast(error.message);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _open(AppNotification notification) async {
    // Read first, then navigate: if the route push fails the row is still
    // marked, which matches what the customer just did. Skipped while offline —
    // the write cannot succeed, and an optimistic tick that snaps back is a
    // worse answer than leaving the row alone until there is a connection.
    if (notification.isUnread && !ref.read(isOfflineProvider)) {
      try {
        await ref
            .read(notificationsFeedProvider.notifier)
            .markRead(notification.id);
      } on ApiException catch (error) {
        _toast(error.message);
      }
    }

    final String? route = DeepLinks.resolve(notification.link);
    if (!mounted || route == null) return;
    context.push(route);
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(notificationsFeedProvider.notifier).markAllRead();
    } on ApiException catch (error) {
      _toast(error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<NotificationFeed> feed = ref.watch(
      notificationsFeedProvider,
    );
    final NotificationCategory? selected = ref.watch(
      notificationFilterProvider,
    );
    final bool offline = ref.watch(isOfflineProvider);
    final bool hasUnread = (ref.watch(unreadCountProvider).value ?? 0) > 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: <Widget>[
          TextButton(
            // Marking everything read is a write, so it is disabled offline
            // with the reason stated below rather than failing on tap.
            onPressed: (hasUnread && !offline) ? _markAllRead : null,
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          CategoryFilterBar(
            selected: selected,
            onSelected: (NotificationCategory? category) =>
                ref.read(notificationFilterProvider.notifier).select(category),
          ),
          if (offline)
            const Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: OfflineActionNotice(
                message: 'Marking as read needs a connection.',
              ),
            ),
          const Divider(height: 1),
          Expanded(
            child: feed.when(
              loading: () => const AppLoading(label: 'Loading notifications…'),
              error: (Object error, StackTrace _) => AppErrorView(
                error: error,
                onRetry: () =>
                    ref.read(notificationsFeedProvider.notifier).refresh(),
              ),
              data: _buildList,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(NotificationFeed feed) {
    if (feed.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.read(notificationsFeedProvider.notifier).refresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: <Widget>[
            SizedBox(height: MediaQuery.sizeOf(context).height * 0.15),
            AppEmptyState(
              title: ref.watch(notificationFilterProvider) == null
                  ? 'Nothing yet'
                  : 'Nothing in this category',
              message:
                  'Order updates, appointment reminders and offers will '
                  'appear here.',
              icon: Icons.notifications_none_rounded,
              action: FilledButton(
                onPressed: () => context.go(Routes.shop),
                child: const Text('Start shopping'),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(notificationsFeedProvider.notifier).refresh(),
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: feed.items.length + (feed.servedFromCache ? 1 : 0) + 1,
        separatorBuilder: (BuildContext context, int index) =>
            const Divider(height: 1),
        itemBuilder: (BuildContext context, int index) {
          if (feed.servedFromCache && index == 0) {
            return _CacheNotice(age: feed.cacheAge);
          }
          final int offset = feed.servedFromCache ? 1 : 0;
          final int itemIndex = index - offset;

          if (itemIndex >= feed.items.length) {
            return _ListFooter(feed: feed);
          }

          final AppNotification notification = feed.items[itemIndex];
          return NotificationTile(
            notification: notification,
            onTap: () => _open(notification),
          );
        },
      ),
    );
  }
}

/// Says plainly that these rows are a saved copy. P0-12 allows serving a cache
/// offline; it does not allow passing it off as live.
class _CacheNotice extends StatelessWidget {
  const _CacheNotice({this.age});

  final Duration? age;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String suffix = switch (age) {
      null => '',
      final Duration d when d.inMinutes < 1 => ' (just now)',
      final Duration d when d.inHours < 1 => ' (${d.inMinutes}m old)',
      final Duration d when d.inHours < 24 => ' (${d.inHours}h old)',
      final Duration d => ' (${d.inDays}d old)',
    };

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Text(
        'Saved copy$suffix — reconnect to refresh.',
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.outline,
        ),
      ),
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.feed});

  final NotificationFeed feed;

  @override
  Widget build(BuildContext context) {
    if (feed.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (!feed.hasMore) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Center(
          child: Text(
            "That's everything",
            style: Theme.of(context).textTheme.labelSmall
                ?.copyWith(color: Theme.of(context).colorScheme.outline),
          ),
        ),
      );
    }

    return const SizedBox(height: AppSpacing.xl);
  }
}
