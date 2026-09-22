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
/// TODO(core): `optex://orders/{id}` does not reach these routes today.
/// The Android intent filter (`android:scheme="optex"`, no host) and the iOS
/// `CFBundleURLSchemes` entry are both in place, but in that URI `orders` is
/// the *authority*, not a path segment — `Uri.parse('optex://orders/abc').path`
/// is `/abc`. go_router's `RouteConfiguration.normalizeUri` keeps only
/// `uri.path`, so the incoming link resolves to `/abc` and falls through to the
/// router's `errorBuilder`. Two ways to close it, both in `lib/core/` and so
/// outside this slice:
///   * normalise the incoming URI before it reaches go_router (an `app_links`
///     listener, or a custom `RouteInformationParser`) by folding a non-empty
///     authority back onto the front of the path; or
///   * emit links with an empty authority — `optex:///orders/{id}` — which
///     parses to path `/orders/{id}` and already resolves correctly here.
/// The path-parameter half of P0-5 works either way: `/orders/{id}` and
/// `/orders/{id}/tracking` both resolve, and the router's existing
/// `_protectedPrefixes` redirect sends an unauthenticated caller to
/// `/login?from=…` and back again.
List<RouteBase> ordersRoutes() => <RouteBase>[
      GoRoute(
        path: Routes.orders,
        builder: (BuildContext context, GoRouterState state) => const OrdersScreen(),
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
