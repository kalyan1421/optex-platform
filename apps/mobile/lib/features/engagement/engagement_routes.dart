import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'ui/notifications_screen.dart';
import 'ui/settings_screen.dart';

/// Routes contributed by the engagement slice.
///
/// TODO(core): add `...engagementRoutes()` to `featureRoutes()` in
/// `lib/core/router/feature_routes.dart`, and wrap the app with
/// `EngagementHost` (see `ui/engagement_host.dart`) via
/// `MaterialApp.router(builder:)` — without the host there is no offline
/// banner, no foreground badge refresh and no version gate.
///
/// Merged into the app by `lib/core/router/feature_routes.dart`. Both paths are
/// under `Routes`' protected prefixes (`/notifications` directly, `/account`
/// for settings), so `app_router.dart`'s redirect already sends a signed-out
/// customer to login and brings them back afterwards — there is nothing to
/// guard here.
List<RouteBase> engagementRoutes() => <RouteBase>[
      GoRoute(
        path: Routes.notifications,
        builder: (BuildContext context, GoRouterState state) =>
            const NotificationsScreen(),
      ),
      GoRoute(
        path: Routes.settings,
        builder: (BuildContext context, GoRouterState state) =>
            const SettingsScreen(),
      ),
    ];
