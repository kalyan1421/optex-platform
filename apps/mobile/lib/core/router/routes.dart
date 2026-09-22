/// Every route path in the app, in one place.
///
/// Declared centrally — including for features not yet built — so that parallel
/// feature work cannot invent three different spellings of the same path, and
/// so deep links (SPEC-11 P0-5, P0-10) have a single source of truth.
class Routes {
  const Routes._();

  // Shell tabs
  static const String home = '/';
  static const String shop = '/shop';
  static const String cart = '/cart';
  static const String account = '/account';

  // Auth
  static const String login = '/login';
  static const String signup = '/signup';
  static const String forgotPassword = '/forgot-password';

  // Catalog
  static const String search = '/search';
  static const String category = '/category/:slug';
  static const String product = '/product/:slug';
  static String productOf(String slug) => '/product/$slug';
  static String categoryOf(String slug) => '/category/$slug';

  // Commerce
  static const String checkout = '/checkout';
  static const String orderConfirmation = '/orders/:id/confirmation';
  static String orderConfirmationOf(String id) => '/orders/$id/confirmation';

  // Orders
  static const String orders = '/orders';
  static const String orderDetail = '/orders/:id';
  static String orderDetailOf(String id) => '/orders/$id';
  static const String orderTracking = '/orders/:id/tracking';
  static String orderTrackingOf(String id) => '/orders/$id/tracking';

  // Account
  static const String profile = '/account/profile';
  static const String addresses = '/account/addresses';
  static const String wishlist = '/account/wishlist';
  static const String branches = '/branches';

  // Clinical
  static const String prescriptions = '/prescriptions';
  static const String prescriptionUpload = '/prescriptions/upload';
  static const String appointments = '/appointments';
  static const String appointmentBooking = '/appointments/book';
  static const String eyeCare = '/eye-care';

  // Engagement
  static const String notifications = '/notifications';
  static const String settings = '/account/settings';

  /// Custom scheme for push payloads and shared links: `optex://orders/{id}`.
  static const String deepLinkScheme = 'optex';
}
