import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/order.dart';
import '../state/orders_providers.dart';
import 'widgets/order_card.dart';

/// Order history — `Routes.orders`.
///
/// Paginated and pull-to-refresh. The three required states are all here, and
/// all three are scrollable so the refresh gesture works even when the list is
/// empty or the first load failed: a user whose connection dropped should be
/// able to pull rather than hunt for a button.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  final ScrollController _scroll = ScrollController();

  /// How close to the bottom the next page starts loading. Roughly two cards,
  /// so the spinner is usually already gone by the time it would be seen.
  static const double _loadMoreThreshold = 400;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_maybeLoadMore);
  }

  @override
  void dispose() {
    _scroll.removeListener(_maybeLoadMore);
    _scroll.dispose();
    super.dispose();
  }

  void _maybeLoadMore() {
    if (!_scroll.hasClients) return;
    final ScrollPosition position = _scroll.position;
    if (position.pixels < position.maxScrollExtent - _loadMoreThreshold) return;
    // The controller itself guards against re-entry and against asking for a
    // page the server does not have, so firing on every scroll tick is safe.
    unawaited(ref.read(ordersFeedProvider.notifier).loadMore());
  }

  Future<void> _refresh() => ref.read(ordersFeedProvider.notifier).refresh();

  @override
  Widget build(BuildContext context) {
    final AsyncValue<OrdersFeed> feed = ref.watch(ordersFeedProvider);
    final OrdersFeed? data = feed.value;

    final Widget body;
    if (data != null && data.isEmpty) {
      body = _Centered(
        child: AppEmptyState(
          title: 'No orders yet',
          message:
              'When you buy frames or lenses from Optex, your orders and '
              'their delivery status show up here.',
          icon: Icons.receipt_long_outlined,
          action: FilledButton.icon(
            onPressed: () => context.go(Routes.shop),
            icon: const Icon(Icons.storefront_outlined),
            label: const Text('Start shopping'),
          ),
        ),
      );
    } else if (data != null) {
      body = _OrdersList(feed: data, controller: _scroll);
    } else if (feed.error != null) {
      body = _Centered(
        child: AppErrorView(error: feed.error!, onRetry: _refresh),
      );
    } else {
      body = const _Centered(child: AppLoading(label: 'Loading your orders…'));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: SafeArea(
        child: RefreshIndicator(onRefresh: _refresh, child: body),
      ),
    );
  }
}

/// Makes a non-scrolling state pullable, so `RefreshIndicator` still fires.
class _Centered extends StatelessWidget {
  const _Centered({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (BuildContext context, BoxConstraints constraints) =>
        SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: child,
          ),
        ),
  );
}

class _OrdersList extends StatelessWidget {
  const _OrdersList({required this.feed, required this.controller});

  final OrdersFeed feed;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: feed.orders.length + 1,
      separatorBuilder: (BuildContext context, int index) =>
          const SizedBox(height: AppSpacing.md),
      itemBuilder: (BuildContext context, int index) {
        if (index == feed.orders.length) return _Footer(feed: feed);
        final OrderSummary order = feed.orders[index];
        return OrderCard(
          order: order,
          onOpen: () => context.push(Routes.orderDetailOf(order.id)),
          onTrack: () => context.push(Routes.orderTrackingOf(order.id)),
        );
      },
    );
  }
}

/// Paging footer: spinner, retry, end-of-list marker, or nothing.
class _Footer extends ConsumerWidget {
  const _Footer({required this.feed});

  final OrdersFeed feed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);

    if (feed.loadMoreError != null) {
      final Object error = feed.loadMoreError!;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Column(
          children: <Widget>[
            Text(
              error is ApiException
                  ? error.message
                  : 'Could not load more orders.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: () => ref.read(ordersFeedProvider.notifier).loadMore(),
              child: const Text('Try again'),
            ),
          ],
        ),
      );
    }

    if (feed.isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ),
      );
    }

    if (feed.hasMore) return const SizedBox(height: AppSpacing.xl);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          feed.orders.length == 1
              ? 'That is your only order so far.'
              : 'That is all ${feed.orders.length} of your orders.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ),
    );
  }
}
