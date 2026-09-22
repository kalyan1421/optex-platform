import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'ui/cart_screen.dart';
import 'ui/checkout_screen.dart';
import 'ui/order_confirmation_screen.dart';

/// Routes contributed by the commerce slice, for `featureRoutes()` to merge.
///
/// Paths come from [Routes] — never a literal — so the router, the deep-link
/// handler and these screens cannot drift apart.
///
/// Two routes that are deliberately NOT here:
///
///   * **The Pesapal webview.** It is pushed onto the [Navigator] from the
///     checkout screen. Giving it a path would make a payment page something a
///     deep link could open, and something back navigation could land on after
///     the payment finished.
///   * **`Routes.cart` as a shell tab.** It is declared as a plain top-level
///     route here. When the shell lands, the integrator wraps this same
///     `GoRoute` in the cart branch; nothing in the screen assumes either.
List<RouteBase> commerceRoutes() => <RouteBase>[
  GoRoute(
    path: Routes.cart,
    builder: (BuildContext context, GoRouterState state) => const CartScreen(),
  ),
  GoRoute(
    path: Routes.checkout,
    builder: (BuildContext context, GoRouterState state) =>
        const CheckoutScreen(),
  ),
  GoRoute(
    // `/orders/:id/confirmation`. Distinct from the orders slice's
    // `/orders/:id` — different segment counts, so the two cannot shadow
    // each other whichever order they are registered in.
    path: Routes.orderConfirmation,
    builder: (BuildContext context, GoRouterState state) =>
        OrderConfirmationScreen(orderId: state.pathParameters['id'] ?? ''),
  ),
];
