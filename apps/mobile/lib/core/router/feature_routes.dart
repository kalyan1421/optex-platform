import 'package:go_router/go_router.dart';

/// Registry of routes contributed by feature modules.
///
/// Each feature owns a `lib/features/<slice>/<slice>_routes.dart` exporting a
/// `List<RouteBase>`, and they are merged here at integration time. Keeping the
/// registry separate from `app_router.dart` is what lets several features be
/// built in parallel without every one of them editing the router.
List<RouteBase> featureRoutes() => <RouteBase>[];
