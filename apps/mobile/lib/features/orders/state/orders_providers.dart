/// Riverpod 3 wiring for the orders slice.
///
/// Automatic provider retry is switched off everywhere here
/// (`retry: _noRetry`). Riverpod 3 will otherwise re-run a failed provider on a
/// backoff, which for a 404 — the single most likely failure on an order route,
/// since an order that is not yours returns one — means silently hammering an
/// endpoint that will never succeed while the user looks at a stale spinner.
/// Retrying is the user's decision, via `AppErrorView`'s button.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/paginated.dart';
import '../../../core/providers.dart';
import '../data/orders_repository.dart';
import '../domain/cancellation.dart';
import '../domain/order.dart';
import '../domain/order_tracking.dart';

Duration? _noRetry(int retryCount, Object error) => null;

final Provider<OrdersRepository> ordersRepositoryProvider = Provider<OrdersRepository>(
  (Ref ref) => OrdersRepository(ref.watch(apiClientProvider)),
);

/// The accumulated order history: every page fetched so far, plus the paging
/// cursor and a separate "loading the next page" flag.
///
/// The flag is part of the value rather than the surrounding [AsyncValue] so
/// that fetching page 2 does not throw the whole list back to a full-screen
/// spinner — the user keeps reading page 1 while page 2 arrives.
class OrdersFeed {
  const OrdersFeed({
    required this.orders,
    required this.page,
    required this.pageSize,
    required this.total,
    this.isLoadingMore = false,
    this.loadMoreError,
  });

  final List<OrderSummary> orders;
  final int page;
  final int pageSize;
  final int total;
  final bool isLoadingMore;

  /// A failure while appending a page. Deliberately not fatal: the pages
  /// already on screen stay, and the footer offers a retry.
  final Object? loadMoreError;

  bool get isEmpty => orders.isEmpty;

  /// Counted against what has actually been received rather than
  /// `page * pageSize`, which drifts the moment the server trims a page.
  bool get hasMore => orders.length < total;

  OrdersFeed copyWith({
    List<OrderSummary>? orders,
    int? page,
    int? pageSize,
    int? total,
    bool? isLoadingMore,
    Object? loadMoreError,
    bool clearLoadMoreError = false,
  }) =>
      OrdersFeed(
        orders: orders ?? this.orders,
        page: page ?? this.page,
        pageSize: pageSize ?? this.pageSize,
        total: total ?? this.total,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        loadMoreError: clearLoadMoreError ? null : (loadMoreError ?? this.loadMoreError),
      );
}

/// Owns the paginated order history.
class OrdersFeedController extends AsyncNotifier<OrdersFeed> {
  static const int _pageSize = 20;

  @override
  Future<OrdersFeed> build() => _firstPage(ref.watch(ordersRepositoryProvider));

  Future<OrdersFeed> _firstPage(OrdersRepository repo) async {
    final Paginated<OrderSummary> page = await repo.list(page: 1, pageSize: _pageSize);
    return OrdersFeed(
      orders: page.items,
      page: page.page,
      pageSize: page.pageSize > 0 ? page.pageSize : _pageSize,
      total: page.total,
    );
  }

  /// Pull-to-refresh: back to page one, discarding everything appended.
  ///
  /// Returns normally on failure — the error lands in [state] and is rendered
  /// by the screen, so the `RefreshIndicator` is not left spinning.
  Future<void> refresh() async {
    final OrdersRepository repo = ref.read(ordersRepositoryProvider);
    state = await AsyncValue.guard<OrdersFeed>(() => _firstPage(repo));
  }

  /// Appends the next page. A no-op when one is already in flight or the
  /// server has nothing left, so a fast scroll cannot queue four requests.
  Future<void> loadMore() async {
    final OrdersFeed? current = state.value;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    state = AsyncValue<OrdersFeed>.data(
      current.copyWith(isLoadingMore: true, clearLoadMoreError: true),
    );

    try {
      final Paginated<OrderSummary> next = await ref
          .read(ordersRepositoryProvider)
          .list(page: current.page + 1, pageSize: current.pageSize);

      // De-duplicated by id: a new order placed mid-scroll shifts every page
      // boundary down by one, which would otherwise repeat a row.
      final Set<String> seen = current.orders.map((OrderSummary o) => o.id).toSet();
      final List<OrderSummary> merged = <OrderSummary>[
        ...current.orders,
        ...next.items.where((OrderSummary o) => seen.add(o.id)),
      ];

      state = AsyncValue<OrdersFeed>.data(
        OrdersFeed(
          orders: merged,
          page: current.page + 1,
          pageSize: current.pageSize,
          // An empty page ends the list regardless of what `total` claims.
          // Without this, a `total` that outruns the rows actually returned
          // (rows deleted between pages) leaves `hasMore` permanently true and
          // every scroll tick asks for another page that will never arrive.
          total: next.items.isEmpty ? merged.length : next.total,
        ),
      );
    } catch (error) {
      // Deliberately not `on ApiException`: a malformed payload throws a cast
      // error, and letting that escape an un-awaited call would surface as an
      // unhandled async error instead of a retry button.
      state = AsyncValue<OrdersFeed>.data(
        current.copyWith(isLoadingMore: false, loadMoreError: error),
      );
    }
  }
}

final AsyncNotifierProvider<OrdersFeedController, OrdersFeed> ordersFeedProvider =
    AsyncNotifierProvider<OrdersFeedController, OrdersFeed>(
  OrdersFeedController.new,
  retry: _noRetry,
);

/// One order in full. Auto-disposed: an order the user has walked away from is
/// not worth holding, and coming back should show current data anyway.
final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, String>(
  (Ref ref, String orderId) => ref.watch(ordersRepositoryProvider).detail(orderId),
  retry: _noRetry,
);

/// The server-rendered tracking timeline for one order.
final orderTrackingProvider = FutureProvider.autoDispose.family<OrderTracking, String>(
  (Ref ref, String orderId) => ref.watch(ordersRepositoryProvider).tracking(orderId),
  retry: _noRetry,
);

/// Cancellation eligibility + the latest request for one order.
final cancellationStatusProvider =
    FutureProvider.autoDispose.family<CancellationStatus, String>(
  (Ref ref, String orderId) =>
      ref.watch(ordersRepositoryProvider).cancellationStatus(orderId),
  retry: _noRetry,
);

/// Re-reads everything that a decision about this order could have changed.
///
/// A cancellation request does not alter the order today (an admin must
/// approve it first), but an approval that lands between the POST and this call
/// does — so the order, its timeline and the history list are all refreshed
/// rather than just the cancellation panel.
void invalidateOrder(WidgetRef ref, String orderId) {
  ref.invalidate(cancellationStatusProvider(orderId));
  ref.invalidate(orderDetailProvider(orderId));
  ref.invalidate(orderTrackingProvider(orderId));
  ref.invalidate(ordersFeedProvider);
}
