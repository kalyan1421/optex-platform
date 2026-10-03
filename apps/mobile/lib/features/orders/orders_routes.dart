import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/widgets/async_views.dart';
import 'ui/order_detail_screen.dart';
import 'ui/order_tracking_screen.dart';
import 'ui/orders_screen.dart';

/// Routes contributed by the orders slice, merged in `core/router/feature_routes.dart`.
///
/// Flat rather than nested: `Routes` declares each path in full, and go_router
/// requires sub-route paths to be relative — nesting would mean writing
/// `'tracking'` as a literal here, which AGENTS.md rule 8 exists to prevent.
/// The screens compensate by checking `context.canPop()` and falling back to
/// `Routes.orders`, so a cold deep link never lands on a dead-end back button.
///
/// `optex://orders/{id}` reaches these routes: in that URI `orders` is the
/// *authority*, not a path segment, which go_router would drop — so
/// `lib/core/router/deep_links.dart` folds it back onto the path before the
/// router sees it (covered by `test/deep_links_test.dart`). The router's
/// `_protectedPrefixes` redirect then sends an unauthenticated caller to
/// `/login?from=…` and back again.
List<RouteBase> ordersRoutes() => <RouteBase>[
  GoRoute(
    path: Routes.orders,
    builder: (BuildContext context, GoRouterState state) =>
        const OrdersScreen(),
  ),
  GoRoute(
    path: Routes.orderDetail,
    builder: (BuildContext context, GoRouterState state) {
      final String? id = _orderId(state);
      return id == null
          ? const _MissingOrder()
          : OrderDetailScreen(orderId: id);
    },
  ),
  GoRoute(
    path: Routes.orderTracking,
    builder: (BuildContext context, GoRouterState state) {
      final String? id = _orderId(state);
      return id == null
          ? const _MissingOrder()
          : OrderTrackingScreen(orderId: id);
    },
  ),
];

/// The `:id` path parameter, or null when it is absent or blank.
///
/// go_router will not match the route without it, but a malformed deep link
/// can still deliver an empty segment — and an empty id would be appended to
/// `/orders/` and sent to the API as a request for the whole collection.
String? _orderId(GoRouterState state) {
  final String? raw = state.pathParameters['id'];
  if (raw == null) return null;
  final String trimmed = raw.trim();
  return trimmed.isEmpty ? null : trimmed;
}

/// Shown when a link carried no usable order id.
class _MissingOrder extends StatelessWidget {
  const _MissingOrder();

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Order')),
    body: AppEmptyState(
      title: 'Order not found',
      message: 'That link did not include an order reference.',
      icon: Icons.receipt_long_outlined,
      action: FilledButton(
        onPressed: () => context.go(Routes.orders),
        child: const Text('My orders'),
      ),
    ),
  );
}
