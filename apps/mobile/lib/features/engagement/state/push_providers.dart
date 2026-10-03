import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/push_service.dart';
import '../domain/notification_category.dart';
import 'engagement_providers.dart';

/// Everything the settings screen needs to describe the push subsystem.
class PushState {
  const PushState({
    required this.available,
    required this.permission,
    required this.mutedCategories,
    required this.promptedBefore,
    this.token,
  });

  /// False when Firebase did not initialise — no `google-services.json` /
  /// `GoogleService-Info.plist` in the repo yet (SPEC-11 Q1/Q2). The UI says so
  /// plainly rather than offering a button that cannot work.
  final bool available;

  final PushPermission permission;
  final Set<NotificationCategory> mutedCategories;

  /// Whether the system dialog has already been shown once. After that, only
  /// system settings can change the answer.
  final bool promptedBefore;

  final String? token;

  bool get isEnabled =>
      available &&
      (permission == PushPermission.granted ||
          permission == PushPermission.provisional);

  bool get canPrompt =>
      available &&
      (permission == PushPermission.notDetermined ||
          permission == PushPermission.denied);

  bool isMuted(NotificationCategory category) =>
      mutedCategories.contains(category);

  PushState copyWith({
    PushPermission? permission,
    Set<NotificationCategory>? mutedCategories,
    bool? promptedBefore,
    String? token,
  }) => PushState(
    available: available,
    permission: permission ?? this.permission,
    mutedCategories: mutedCategories ?? this.mutedCategories,
    promptedBefore: promptedBefore ?? this.promptedBefore,
    token: token ?? this.token,
  );
}

/// Owns the client half of P0-10.
///
/// [build] attaches listeners but never prompts — the permission dialog only
/// fires from [enable], which the settings screen calls after the customer has
/// asked for push and can see what they are agreeing to.
class PushController extends AsyncNotifier<PushState> {
  PushService get _service => ref.read(pushServiceProvider);

  @override
  Future<PushState> build() async {
    // Registration is an authenticated call and a token belongs to whoever is
    // signed in, so this rebuilds on every sign-in and sign-out. That is what
    // registers the handset for a customer who signs in AFTER launch — without
    // it, the token minted while signed out would never reach the server until
    // the next cold start — and what stops registering once they leave.
    ref.watch(
      authControllerProvider.select((AuthState s) => s.isAuthenticated),
    );

    final bool available = await _service.start();
    final PushPermission permission = available
        ? await _service.currentPermission()
        : PushPermission.unavailable;

    final PushState initial = PushState(
      available: available,
      permission: permission,
      mutedCategories: await ref
          .read(notificationPreferencesProvider)
          .mutedCategories(),
      promptedBefore: await ref
          .read(notificationPreferencesProvider)
          .hasPromptedForPermission(),
      token: _service.token,
    );

    // Refresh the token whenever we already have consent — it rotates on
    // reinstall, restore and clear-data, and the rotation listener only covers
    // the case where the app was running at the time.
    if (initial.isEnabled) {
      final String? token = await _service.syncToken();
      return initial.copyWith(token: token);
    }
    return initial;
  }

  /// The in-context permission request. Android 13+ runtime POST_NOTIFICATIONS
  /// and the iOS prompt both go through here.
  Future<PushPermission> enable() async {
    final PushPermission permission = await _service.requestPermission();
    state = AsyncValue<PushState>.data(
      (state.value ??
              const PushState(
                available: false,
                permission: PushPermission.unavailable,
                mutedCategories: <NotificationCategory>{},
                promptedBefore: false,
              ))
          .copyWith(
            permission: permission,
            promptedBefore: true,
            token: _service.token,
          ),
    );
    return permission;
  }

  /// Per-category opt-out.
  ///
  /// Honoured server-side (SPEC-11 P0-10): [PushService.syncPreferences] sends
  /// the new set to the API, which then never sends a muted category to this
  /// device. It is also applied here at once, so a foreground message for a
  /// muted category is dropped even before the round trip lands, and the Android
  /// channel can still be silenced from system settings.
  Future<void> setMuted(NotificationCategory category, bool muted) async {
    final PushState? current = state.value;
    if (current == null) return;

    await ref.read(notificationPreferencesProvider).setMuted(category, muted);

    final Set<NotificationCategory> next = <NotificationCategory>{
      ...current.mutedCategories,
    };
    if (muted) {
      next.add(category);
    } else {
      next.remove(category);
    }

    state = AsyncValue<PushState>.data(current.copyWith(mutedCategories: next));
    await _service.syncPreferences();
  }

  /// Called on sign-out so the handset stops receiving the previous customer's
  /// notifications: deregisters the token and deletes it at Google's end.
  ///
  /// Wired through core's `sessionCleanupProvider` by `EngagementHost`, which
  /// runs it BEFORE the server session is revoked — deregistering is an
  /// authenticated call.
  Future<void> disable() async {
    await _service.disable();
    ref.invalidateSelf();
  }
}

final AsyncNotifierProvider<PushController, PushState> pushControllerProvider =
    AsyncNotifierProvider<PushController, PushState>(PushController.new);
