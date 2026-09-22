import '../../../core/router/routes.dart';

/// Turns a server-authored link or a push payload into an in-app route.
///
/// The API already writes links in the app's own path vocabulary —
/// `/orders/{id}/tracking` (orders.service.ts, cancellation.service.ts),
/// `/appointments` (appointments.service.ts, appointment-reminders.job.ts) and
/// a promotion's `target_url` defaulting to `/shop` (promotions.service.ts) —
/// all of which are spellings `Routes` already declares. So the common case is
/// pass-through validation, not translation.
class DeepLinks {
  const DeepLinks._();

  /// Resolves [raw] to a path `GoRouter` can be handed, or null when it is not
  /// an in-app destination.
  ///
  /// Accepts `optex://orders/{id}` (the custom scheme in `Routes`) and bare
  /// paths like `/orders/{id}/tracking`. An `http(s)` URL returns null on
  /// purpose: a promotion may point at a marketing page that has no in-app
  /// equivalent, and silently rewriting it to a route that does not exist would
  /// dump the customer on the 404 screen.
  static String? resolve(String? raw) {
    final String value = raw?.trim() ?? '';
    if (value.isEmpty) return null;

    final Uri? uri = Uri.tryParse(value);
    if (uri == null) return null;

    if (uri.scheme == Routes.deepLinkScheme) {
      // optex://orders/123 parses as host `orders`, path `/123`.
      final String path = uri.host.isEmpty ? uri.path : '/${uri.host}${uri.path}';
      return _withQuery(path, uri.query);
    }

    if (uri.hasScheme) return null;
    if (!value.startsWith('/')) return null;

    return _withQuery(uri.path, uri.query);
  }

  /// Builds a route from the identifiers a push payload carries, preferring the
  /// most specific one. Used when the sender gives ids rather than a link.
  static String? forEntity({
    String? orderId,
    String? appointmentId,
    String? productSlug,
  }) {
    if (orderId != null && orderId.isNotEmpty) return Routes.orderDetailOf(orderId);
    if (appointmentId != null && appointmentId.isNotEmpty) return Routes.appointments;
    if (productSlug != null && productSlug.isNotEmpty) return Routes.productOf(productSlug);
    return null;
  }

  static String _withQuery(String path, String query) {
    final String safePath = path.isEmpty ? Routes.home : path;
    return query.isEmpty ? safePath : '$safePath?$query';
  }
}
