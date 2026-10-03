import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/account_routes.dart';
import '../../features/catalog/catalog_routes.dart';
import '../../features/clinical/clinical_routes.dart';
import '../../features/clinical/ui/care_hub_screen.dart';
import '../../features/commerce/commerce_routes.dart';
import '../../features/engagement/engagement_routes.dart';
import '../../features/orders/orders_routes.dart';
import 'routes.dart';

/// Splits the feature slices across the five shell branches.
///
/// Each slice still owns and exports one flat list of routes; this file only
/// decides which tab each of those routes belongs under. Doing the split here
/// rather than inside the slices is what let six of them be built in parallel
/// without any of them knowing a shell would exist.
///
/// [_pick] and [_except] match on `GoRoute.path`, which is always a `Routes`
/// constant — so a renamed path fails loudly at the call site below rather
/// than silently dropping a screen out of the app.
List<RouteBase> _pick(List<RouteBase> from, Set<String> paths) => from
    .where((RouteBase r) => r is GoRoute && paths.contains(r.path))
    .toList();

List<RouteBase> _except(List<RouteBase> from, Set<String> paths) => from
    .where((RouteBase r) => r is! GoRoute || !paths.contains(r.path))
    .toList();

/// Routes that must NOT sit inside the shell.
///
/// Checkout is the load-bearing one. A tab bar during payment is an escape
/// hatch straight out of a flow that has already created a server-side order,
/// and commerce has no customer-facing cancel for `pending_payment` — so a
/// stray tap leaves an unpaid order only staff can clear. The auth screens are
/// pre-session, and prescription capture is a full-bleed camera surface.
List<RouteBase> topLevelRoutes() => <RouteBase>[
  ..._pick(accountRoutes(), <String>{
    Routes.login,
    Routes.signup,
    Routes.forgotPassword,
  }),
  ..._pick(commerceRoutes(), <String>{
    Routes.checkout,
    Routes.orderConfirmation,
  }),
  ..._pick(clinicalRoutes(), <String>{Routes.prescriptionUpload}),
];

/// One entry per tab, in bar order. Index here is the index in [AppShell].
List<List<RouteBase>> shellBranches() => <List<RouteBase>>[
  // Home
  _pick(catalogRoutes(), <String>{Routes.home}),

  // Shop — browsing and everything reachable from a product card.
  _pick(catalogRoutes(), <String>{
    Routes.shop,
    Routes.search,
    Routes.category,
    Routes.product,
  }),

  // Care — the clinical surfaces, behind a hub that gives them a front door.
  <RouteBase>[
    GoRoute(
      path: Routes.care,
      builder: (BuildContext context, GoRouterState state) =>
          const CareHubScreen(),
    ),
    ..._except(clinicalRoutes(), <String>{Routes.prescriptionUpload}),
  ],

  // Cart
  _pick(commerceRoutes(), <String>{Routes.cart}),

  // Account — the profile surfaces plus order history and notifications,
  // which are things you look up about yourself rather than destinations.
  <RouteBase>[
    ..._except(accountRoutes(), <String>{
      Routes.login,
      Routes.signup,
      Routes.forgotPassword,
    }),
    ...ordersRoutes(),
    ...engagementRoutes(),
  ],
];
