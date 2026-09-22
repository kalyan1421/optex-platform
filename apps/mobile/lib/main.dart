import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/env/app_env.dart';
import 'core/providers.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

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

  final ProviderContainer container = ProviderContainer();
  await bootstrapAuth(container);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const OptexApp(),
    ),
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
    );
  }
}
