import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/router/app_router.dart';
import '../data/notification_preferences.dart';
import '../data/notifications_repository.dart';
import '../data/offline_cache.dart';
import '../data/push_registrar.dart';
import '../data/push_service.dart';

/// Shared wiring for the engagement slice.
///
/// Nothing here is constructed by feature code directly, so a test can override
/// any layer — the same shape as `lib/core/providers.dart`.

/// The slice-local offline store (SPEC-11 P0-12).
///
/// Lives here rather than in core only because core is the integrator's to
/// change; it has no dependency on anything in this slice and can be promoted
/// as-is.
///
/// TODO(core): cached documents are per-customer, so sign-out should call
/// `clear()` on this. The hook belongs in `AuthController.logout()`
/// (`lib/core/providers.dart`), which this slice must not edit.
final Provider<OfflineCache> offlineCacheProvider = Provider<OfflineCache>((
  Ref ref,
) {
  final OfflineCache cache = OfflineCache();
  ref.onDispose(cache.close);
  return cache;
});

final Provider<NotificationPreferences> notificationPreferencesProvider =
    Provider<NotificationPreferences>((Ref ref) => NotificationPreferences());

final Provider<NotificationsRepository> notificationsRepositoryProvider =
    Provider<NotificationsRepository>(
      (Ref ref) => NotificationsRepository(ref.watch(apiClientProvider)),
    );

/// Today's registrar: records the token locally and calls nothing, because
/// there is no endpoint to call (SPEC-11 §8, B-1). Typed concretely so the
/// settings screen can read `lastToken` for its diagnostics row; swap the
/// return for a real implementation and every caller keeps working.
final Provider<UnregisteredPushRegistrar> pushRegistrarProvider =
    Provider<UnregisteredPushRegistrar>(
      (Ref ref) => UnregisteredPushRegistrar(),
    );

/// Routes a notification tap into the app.
///
/// Reads the core router rather than holding a `NavigatorState`, so a tap that
/// lands on a protected route still passes through the auth redirect in
/// `app_router.dart` instead of bypassing it.
final Provider<PushDeepLinkHandler> pushDeepLinkHandlerProvider =
    Provider<PushDeepLinkHandler>((Ref ref) {
      return (String route) {
        try {
          ref.read(routerProvider).go(route);
        } catch (error) {
          developer.log(
            'Deep link to $route failed: $error',
            name: 'optex.engagement',
          );
        }
      };
    });

final Provider<PushService> pushServiceProvider = Provider<PushService>((
  Ref ref,
) {
  final PushService service = PushService(
    registrar: ref.watch(pushRegistrarProvider),
    preferences: ref.watch(notificationPreferencesProvider),
    onDeepLink: ref.watch(pushDeepLinkHandlerProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});
