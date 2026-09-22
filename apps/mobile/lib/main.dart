import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/env/app_env.dart';
import 'core/providers.dart';
import 'core/router/app_router.dart';
import 'core/router/deep_links.dart';
import 'core/theme/app_theme.dart';
import 'features/catalog/state/add_to_cart.dart';
import 'features/engagement/ui/engagement_host.dart';
import 'integration/cart_bridge.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Supabase is initialised for one job: the on-device Google and Apple
  // handshakes (`signInWithIdToken`). Every other call in the app goes through
  // the OPTEX API, which owns all writes — the client never queries Postgres
  // directly, exactly as the web apps are structured.
  if (AppEnv.supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(
      url: AppEnv.supabaseUrl,
      publishableKey: AppEnv.supabaseAnonKey,
      debug: !AppEnv.isProd,
    );
  }

  final ProviderContainer container = ProviderContainer(
    overrides: [
      // Connects the catalog's add-to-cart button to the commerce cart.
      addToCartHandlerProvider.overrideWith(buildAddToCartHandler),
    ],
  );
  // Registered before the first routerProvider read, so this observer sees a
  // platform link before go_router's own does. See DeepLinkObserver.
  WidgetsBinding.instance.addObserver(
    DeepLinkObserver(
      (String route) => container.read(routerProvider).go(route),
    ),
  );

  await bootstrapAuth(container);

  runApp(
    UncontrolledProviderScope(container: container, child: const OptexApp()),
  );
}

class OptexApp extends ConsumerWidget {
  const OptexApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'OPTEX Opticians',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      // Wraps every screen: offline banner, foreground badge refresh and the
      // version gate. Mounted here rather than per-screen so nothing can ship
      // a route that quietly opts out of them.
      builder: (BuildContext context, Widget? child) => CartBridge(
        child: EngagementHost(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
