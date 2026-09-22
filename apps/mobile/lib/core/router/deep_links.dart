import 'package:flutter/widgets.dart';

import 'routes.dart';

/// Normalises an incoming deep link into a path go_router can match.
///
/// The trap: in `optex://orders/abc`, `orders` is the URI **authority**, not
/// part of the path. `Uri.parse` yields `host: "orders", path: "/abc"`, and
/// go_router matches on `uri.path` alone — so the link routes to `/abc`, misses
/// every route, and lands on the error page. Every push-notification tap and
/// every shared product link would dead-end, which is exactly the failure that
/// is hardest to notice in testing because the OS hands the app the link
/// perfectly correctly.
///
/// `optex:///orders/abc` (three slashes, empty authority) already parses as
/// `path: "/orders/abc"` and needs no repair. Both forms are handled here so
/// that a link minted by hand, or by a server that did not get the memo, still
/// works.
///
/// Links the app *emits* should use the `optex:///` form — see
/// [buildDeepLink].
String normalizeDeepLink(Uri uri) {
  final String path = uri.path.startsWith('/') ? uri.path : '/${uri.path}';

  // Fold a non-empty authority back onto the front of the path.
  final String merged = uri.authority.isEmpty ? path : '/${uri.authority}$path';

  final String collapsed = merged.replaceAll(RegExp('/+'), '/');
  final String trimmed = collapsed.length > 1 && collapsed.endsWith('/')
      ? collapsed.substring(0, collapsed.length - 1)
      : collapsed;

  return uri.hasQuery ? '$trimmed?${uri.query}' : trimmed;
}

/// Builds a link in the unambiguous three-slash form.
///
/// Use this everywhere the app or the API mints a link — notification payloads
/// (backend item B-1), share sheets, emails — so nothing depends on the
/// authority-folding repair above.
String buildDeepLink(String path) {
  final String p = path.startsWith('/') ? path : '/$path';
  return '${Routes.deepLinkScheme}://$p';
}

/// Resolves the route to open from a raw deep-link string.
///
/// Returns null when the link is unparseable or belongs to another scheme, so
/// callers can ignore it rather than navigating somewhere arbitrary.
String? routeForDeepLink(String? raw) {
  if (raw == null || raw.isEmpty) return null;

  final Uri? uri = Uri.tryParse(raw);
  if (uri == null) return null;

  // A bare path (how Flutter delivers `defaultRouteName`) is already usable.
  if (!uri.hasScheme) return normalizeDeepLink(uri);

  if (uri.scheme != Routes.deepLinkScheme) return null;

  final String route = normalizeDeepLink(uri);
  return route == '/' ? null : route;
}

/// Intercepts platform deep links before go_router normalises them.
///
/// go_router matches on `uri.path` alone, which silently discards the
/// authority — so `optex://orders/123` arrives as `/123` and `optex://cart` as
/// the empty path, landing on home. [normalizeDeepLink] repairs that, but it
/// only helps if something applies it to the *incoming* link, which is what
/// this observer does.
///
/// It must be registered **before** the router creates its own observer,
/// because Flutter dispatches `didPushRouteInformation` in registration order
/// and stops at the first observer that returns true. Registering it in `main`,
/// ahead of the first `routerProvider` read, is what guarantees that.
class DeepLinkObserver with WidgetsBindingObserver {
  DeepLinkObserver(this._navigate);

  final void Function(String route) _navigate;

  @override
  Future<bool> didPushRouteInformation(
    RouteInformation routeInformation,
  ) async {
    final Uri uri = routeInformation.uri;

    // Only claim our own scheme. Plain paths and https links are left for
    // go_router and anything else that wants them.
    if (uri.scheme != Routes.deepLinkScheme) return false;

    final String? route = routeForDeepLink(uri.toString());
    if (route == null) return false;

    _navigate(route);
    return true;
  }
}

/// The route a cold start should open, from the launch URI.
///
/// `didPushRouteInformation` never fires for the link that launched the
/// process, so the cold-start case has to be read separately.
String? initialRouteFromLaunch(String defaultRouteName) {
  final Uri? uri = Uri.tryParse(defaultRouteName);
  if (uri == null || uri.scheme != Routes.deepLinkScheme) return null;
  return routeForDeepLink(defaultRouteName);
}
