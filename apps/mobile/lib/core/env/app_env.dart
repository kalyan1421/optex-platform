/// Build-time configuration, injected with `--dart-define`.
///
/// Nothing here is a secret: the Supabase anon key is public by design (the
/// service-role key must never reach a client), and the API base URL is
/// discoverable from any network trace. Real secrets live server-side in
/// `apps/api`, which owns every write.
///
/// Flavours are selected at build time rather than at runtime so a production
/// binary cannot be pointed at a development database by anything a user does:
///
///   flutter run --dart-define=OPTEX_ENV=dev
///   flutter build apk --dart-define=OPTEX_ENV=prod --dart-define=API_BASE_URL=...
enum Flavor { dev, staging, prod }

class AppEnv {
  const AppEnv._();

  static const String _rawFlavor = String.fromEnvironment('OPTEX_ENV', defaultValue: 'dev');

  static Flavor get flavor => switch (_rawFlavor) {
        'prod' => Flavor.prod,
        'staging' => Flavor.staging,
        _ => Flavor.dev,
      };

  static bool get isProd => flavor == Flavor.prod;

  /// The NestJS API. Routes are mounted under `/api` (see `apps/api`).
  ///
  /// The Android emulator reaches the host machine on 10.0.2.2, not localhost —
  /// a dev-only footgun that costs an hour the first time it bites.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:1111/api',
  );

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'http://10.0.2.2:54321',
  );

  static const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// OAuth client IDs for Google Sign-In.
  ///
  /// BLOCKED ON Q1/Q2 (SPEC-11): the Google Cloud project and the Apple
  /// Developer account do not exist yet, so these are empty in every build
  /// today. `AuthRepository.signInWithGoogle` checks for that and fails with a
  /// clear message rather than a null-pointer deep inside the plugin.
  static const String googleServerClientId =
      String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
  static const String googleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  static bool get googleSignInConfigured => googleServerClientId.isNotEmpty;
}
