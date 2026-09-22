import 'dart:developer' as developer;

import 'package:shared_preferences/shared_preferences.dart';

import '../domain/notification_category.dart';

/// Per-category push opt-out, stored on the device.
///
/// TODO(B-1): SPEC-11 P0-10 requires the opt-out to be "honoured server-side",
/// which needs the preference to travel with the device token — there is no
/// endpoint to send it to yet (no `device_tokens` table, no register route).
/// Until B-1 lands this is enforced purely client-side: a muted category is
/// still *delivered* by FCM but is not displayed, which is the most a client
/// can do on its own. `PushRegistrar.register` already takes the muted set, so
/// wiring the server side is a change in one place.
///
/// Note these are push-display preferences only. They deliberately do **not**
/// filter the in-app notification centre: a customer who silenced offer pushes
/// has not asked for their offer history to disappear.
class NotificationPreferences {
  NotificationPreferences();

  static const String _mutedPrefix = 'optex.push.muted.';
  static const String _permissionPromptedKey = 'optex.push.permission_prompted';

  Future<SharedPreferences?> _prefs() async {
    try {
      return await SharedPreferences.getInstance();
    } catch (error) {
      developer.log('Notification preferences unavailable: $error',
          name: 'optex.engagement');
      return null;
    }
  }

  Future<Set<NotificationCategory>> mutedCategories() async {
    final SharedPreferences? prefs = await _prefs();
    if (prefs == null) return <NotificationCategory>{};

    return <NotificationCategory>{
      for (final NotificationCategory category in NotificationCategory.values)
        if (prefs.getBool('$_mutedPrefix${category.wire}') ?? false) category,
    };
  }

  Future<bool> isMuted(NotificationCategory category) async {
    final SharedPreferences? prefs = await _prefs();
    return prefs?.getBool('$_mutedPrefix${category.wire}') ?? false;
  }

  Future<void> setMuted(NotificationCategory category, bool muted) async {
    final SharedPreferences? prefs = await _prefs();
    await prefs?.setBool('$_mutedPrefix${category.wire}', muted);
  }

  /// Whether the in-context permission prompt has already been shown once.
  ///
  /// Both platforms only ever show the system dialog once; after that a denial
  /// can only be undone in system settings. Knowing we have asked lets the
  /// settings screen say "open system settings" instead of firing a request
  /// that will silently no-op.
  Future<bool> hasPromptedForPermission() async {
    final SharedPreferences? prefs = await _prefs();
    return prefs?.getBool(_permissionPromptedKey) ?? false;
  }

  Future<void> markPromptedForPermission() async {
    final SharedPreferences? prefs = await _prefs();
    await prefs?.setBool(_permissionPromptedKey, true);
  }
}
