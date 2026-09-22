import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';
import '../widgets/async_views.dart';
import 'feature_routes.dart';
import 'routes.dart';

/// Routes that require a signed-in customer.
///
/// Deliberately a short list rather than a default-deny. SPEC-11 story 20 is
/// explicit that the whole catalog is browsable before the account wall, which
/// goes up at add-to-cart — so browsing, search, branches and product pages are
/// all open, and only the routes that touch a person's own data are gated.
const List<String> _protectedPrefixes = <String>[
  Routes.cart,
  Routes.checkout,
  Routes.orders,
  Routes.account,
  Routes.prescriptions,
  Routes.appointments,
  Routes.notifications,
];

bool _requiresAuth(String location) =>
    _protectedPrefixes.any((String p) => location == p || location.startsWith('$p/'));

/// Bridges a Riverpod [AuthState] into something GoRouter will listen to.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this._ref) {
    _ref.listen<AuthState>(
      authControllerProvider,
      (AuthState? previous, AuthState next) => notifyListeners(),
    );
  }
  final Ref _ref;
}

final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final _AuthRefresh refresh = _AuthRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.home,
    refreshListenable: refresh,
    redirect: (BuildContext context, GoRouterState state) {
      final AuthState auth = ref.read(authControllerProvider);
      final String location = state.matchedLocation;

      // Hold everything until the stored session has been resolved, so a
      // returning user never sees the login screen flash before their own
      // session loads.
      if (!auth.isResolved) return null;

      final bool onAuthScreen = location == Routes.login ||
          location == Routes.signup ||
          location == Routes.forgotPassword;

      if (!auth.isAuthenticated && _requiresAuth(location)) {
        // Preserve intent: after signing in, finish what they were doing
        // rather than dumping them on the home screen (SPEC-11 P0-3).
        return '${Routes.login}?from=${Uri.encodeComponent(state.uri.toString())}';
      }

      if (auth.isAuthenticated && onAuthScreen) {
        final String? from = state.uri.queryParameters['from'];
        return (from != null && from.isNotEmpty) ? Uri.decodeComponent(from) : Routes.home;
      }

      return null;
    },
    routes: <RouteBase>[
      ...featureRoutes(),
      // Fallback shells for routes whose feature module has not landed yet.
      // Removed as each feature is integrated.
      GoRoute(
        path: Routes.home,
        builder: (BuildContext c, GoRouterState s) =>
            const _Pending(title: 'OPTEX', feature: 'catalog'),
      ),
      GoRoute(
        path: Routes.login,
        builder: (BuildContext c, GoRouterState s) =>
            const _Pending(title: 'Sign in', feature: 'auth UI'),
      ),
    ],
    errorBuilder: (BuildContext context, GoRouterState state) => Scaffold(
      appBar: AppBar(title: const Text('Not found')),
      body: AppEmptyState(
        title: 'Page not found',
        message: state.uri.toString(),
        icon: Icons.explore_off_outlined,
        action: FilledButton(
          onPressed: () => context.go(Routes.home),
          child: const Text('Go home'),
        ),
      ),
    ),
  );
});

/// Placeholder shown for a route whose feature module is still being built.
class _Pending extends StatelessWidget {
  const _Pending({required this.title, required this.feature});

  final String title;
  final String feature;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: AppEmptyState(
          title: 'Coming together',
          message: 'The $feature module is not wired up yet.',
          icon: Icons.construction_rounded,
        ),
      );
}
