import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'ui/account_hub_screen.dart';
import 'ui/addresses_screen.dart';
import 'ui/branch_locator_screen.dart';
import 'ui/forgot_password_screen.dart';
import 'ui/login_screen.dart';
import 'ui/profile_screen.dart';
import 'ui/signup_screen.dart';
import 'ui/wishlist_screen.dart';

/// Routes contributed by the account slice, for `feature_routes.dart` to merge.
///
/// Declared flat with absolute paths rather than nested under `/account`,
/// because `Routes` spells every destination out in full and nesting would
/// mean re-deriving each child path from its parent — exactly the drift the
/// central route table exists to prevent.
///
/// `/branches` is intentionally in this list and intentionally *not*
/// authenticated: `GET /branches` is `@Public()` and the router's protected
/// prefixes leave it open, so someone can find a shop before they have an
/// account.
List<RouteBase> accountRoutes() => <RouteBase>[
      GoRoute(
        path: Routes.login,
        builder: (_, GoRouterState state) => LoginScreen(
          // Set by the router's redirect to preserve what the user was
          // trying to reach. Kept encoded: the redirect decodes it.
          from: state.uri.queryParameters['from'],
        ),
      ),
      GoRoute(
        path: Routes.signup,
        builder: (_, GoRouterState state) => SignupScreen(
          from: state.uri.queryParameters['from'],
        ),
      ),
      GoRoute(
        path: Routes.forgotPassword,
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: Routes.account,
        builder: (_, _) => const AccountHubScreen(),
      ),
      GoRoute(
        path: Routes.profile,
        builder: (_, _) => const ProfileScreen(),
      ),
      GoRoute(
        path: Routes.addresses,
        builder: (_, _) => const AddressesScreen(),
      ),
      GoRoute(
        path: Routes.wishlist,
        builder: (_, _) => const WishlistScreen(),
      ),
      GoRoute(
        path: Routes.branches,
        builder: (_, _) => const BranchLocatorScreen(),
      ),
    ];
