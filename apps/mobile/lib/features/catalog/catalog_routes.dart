import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'ui/category_screen.dart';
import 'ui/home_screen.dart';
import 'ui/product_screen.dart';
import 'ui/search_screen.dart';
import 'ui/shop_screen.dart';

/// The catalog slice's routes, merged by `core/router/feature_routes.dart`.
///
/// INTEGRATION NOTE: `app_router.dart` currently declares its own fallback
/// `GoRoute(path: Routes.home)` after `...featureRoutes()`. That placeholder
/// must be removed when this list is registered — two routes for the same
/// path is at best dead code and at worst an ambiguity. Removing it is a core
/// edit, so it belongs to the integrator, not to this slice.
///
/// Every path comes from `Routes`; none is spelled out here.
List<RouteBase> catalogRoutes() => <RouteBase>[
  GoRoute(
    path: Routes.home,
    builder: (BuildContext context, GoRouterState state) => const HomeScreen(),
  ),
  GoRoute(
    path: Routes.shop,
    // `?category=<slug>` opens the shop pre-filtered — what a banner
    // target or a "see all in this category" link needs, without making
    // it a different screen from /shop.
    builder: (BuildContext context, GoRouterState state) =>
        ShopScreen(initialCategorySlug: state.uri.queryParameters['category']),
  ),
  GoRoute(
    path: Routes.search,
    builder: (BuildContext context, GoRouterState state) =>
        SearchScreen(initialQuery: state.uri.queryParameters['q']),
  ),
  GoRoute(
    path: Routes.category,
    builder: (BuildContext context, GoRouterState state) =>
        CategoryScreen(slug: state.pathParameters['slug'] ?? ''),
  ),
  GoRoute(
    path: Routes.product,
    builder: (BuildContext context, GoRouterState state) =>
        ProductScreen(slug: state.pathParameters['slug'] ?? ''),
  ),
];
