import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../domain/notification_category.dart';
import '../domain/push_payload.dart';
import 'firebase_bootstrap.dart';
import 'notification_preferences.dart';
import 'push_registrar.dart';

/// What the OS says about our permission to post notifications.
enum PushPermission {
  /// Firebase never came up — no config files (SPEC-11 Q1/Q2). Push is off and
  /// the rest of the app is unaffected.
  unavailable,

  /// Never asked. The only state in which asking will actually show a dialog.
  notDetermined,

  /// Denied, but the OS will still show a prompt if we ask again.
  denied,

  /// Denied for good — Android 13+ after a second refusal. Only system
  /// settings can undo it, so the UI must offer that instead of a dead button.
  permanentlyDenied,

  granted,

  /// iOS quiet delivery.
  provisional,
}

/// Navigates the app to a route a notification tap resolved to.
///
/// Injected rather than reached for, so the service never holds a
/// `NavigatorState` and a tap that lands on a protected route still passes
/// through the auth redirect in `core/router/app_router.dart`.
typedef PushDeepLinkHandler = void Function(String route);

/// Background isolate entry point.
///
/// Intentionally does nothing. When a push carries a `notification` block the
/// system tray renders it without Dart running at all, and the tap is picked up
/// by `onMessageOpenedApp` / `getInitialMessage` once the app comes up. A
/// data-only push that needed background work would be written here — none
/// exists, because nothing sends pushes yet (SPEC-11 §8, B-1).
@pragma('vm:entry-point')
Future<void> optexFirebaseBackgroundHandler(RemoteMessage message) async {
  // No-op by design; see above.
}

/// The client half of P0-10.
///
/// Everything here works today except the one thing that needs a server:
/// permission, token acquisition, token rotation, foreground display,
/// tap-to-deep-link (background *and* cold start), and per-category muting are
/// all live. Registration is a [PushRegistrar] call that currently goes
/// nowhere — see B-1 there.
///
/// Nothing in this class runs at cold start on its own. [start] only attaches
/// listeners; the permission dialog is [requestPermission], which the settings
/// screen calls when the customer asks for push, never on first launch.
class PushService {
  PushService({
    required this._registrar,
    required this._preferences,
    required this._onDeepLink,
    FlutterLocalNotificationsPlugin? localNotifications,
  }) : _local = localNotifications ?? FlutterLocalNotificationsPlugin();

  final PushRegistrar _registrar;
  final NotificationPreferences _preferences;
  final PushDeepLinkHandler _onDeepLink;
  final FlutterLocalNotificationsPlugin _local;

  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  StreamSubscription<String>? _tokenSub;

  bool _started = false;
  String? _token;
  String? _pendingRoute;

  /// The FCM token currently held, if any.
  String? get token => _token;

  /// A deep link captured before the router was ready — for instance the tap
  /// that launched the app from a terminated state. Read once.
  String? takePendingRoute() {
    final String? route = _pendingRoute;
    _pendingRoute = null;
    return route;
  }

  /// Wires listeners and channels. Safe to call when Firebase is absent: it
  /// returns false and the app carries on without push.
  ///
  /// Does **not** prompt for permission.
  Future<bool> start() async {
    if (_started) return true;
    if (!await FirebaseBootstrap.ensureInitialized()) return false;

    try {
      await _initialiseLocalNotifications();

      FirebaseMessaging.onBackgroundMessage(optexFirebaseBackgroundHandler);

      final FirebaseMessaging messaging = FirebaseMessaging.instance;

      // iOS would otherwise draw its own foreground banner, and we would draw a
      // second one on top of it. Let the local plugin own foreground display on
      // both platforms so muting and payload handling behave the same way.
      await messaging.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: true,
        sound: true,
      );

      _foregroundSub = FirebaseMessaging.onMessage.listen(_onForegroundMessage);
      _openedSub = FirebaseMessaging.onMessageOpenedApp.listen(
        _onMessageOpened,
      );
      _tokenSub = messaging.onTokenRefresh.listen(_onTokenRefresh);

      await _captureColdStartTap(messaging);

      _started = true;
      return true;
    } catch (error) {
      developer.log(
        'Push start failed; continuing without push: $error',
        name: 'optex.engagement',
      );
      return false;
    }
  }

  /// Asks for notification permission **in context** — i.e. from the settings
  /// screen, when the customer has just said they want order updates, never
  /// from a cold start where the dialog has no explanation attached to it.
  ///
  /// On Android 13+ this is the runtime `POST_NOTIFICATIONS` grant (the
  /// manifest permission is already declared); below 33 it is granted by
  /// installation. On iOS it is the UNUserNotificationCenter prompt.
  Future<PushPermission> requestPermission() async {
    if (!await FirebaseBootstrap.ensureInitialized()) {
      return PushPermission.unavailable;
    }

    try {
      await _preferences.markPromptedForPermission();

      if (defaultTargetPlatform == TargetPlatform.android) {
        await _local
            .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin
            >()
            ?.requestNotificationsPermission();
      }

      final NotificationSettings settings = await FirebaseMessaging.instance
          .requestPermission();

      final PushPermission permission = _map(settings.authorizationStatus);
      if (permission == PushPermission.granted ||
          permission == PushPermission.provisional) {
        await start();
        await syncToken();
      }
      return permission;
    } catch (error) {
      developer.log(
        'Permission request failed: $error',
        name: 'optex.engagement',
      );
      return PushPermission.unavailable;
    }
  }

  /// The current permission state, without prompting.
  Future<PushPermission> currentPermission() async {
    if (!await FirebaseBootstrap.ensureInitialized()) {
      return PushPermission.unavailable;
    }
    try {
      final NotificationSettings settings = await FirebaseMessaging.instance
          .getNotificationSettings();
      return _map(settings.authorizationStatus);
    } catch (_) {
      return PushPermission.unavailable;
    }
  }

  /// Mints a token (if permission allows) and hands it to the registrar.
  Future<String?> syncToken() async {
    if (!FirebaseBootstrap.isAvailable) return null;
    try {
      final String? token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return null;
      _token = token;
      await _registrar.register(
        token: token,
        mutedCategories: await _preferences.mutedCategories(),
      );
      return token;
    } catch (error) {
      developer.log('Token sync failed: $error', name: 'optex.engagement');
      return null;
    }
  }

  /// Pushes the current mute set to the registrar.
  ///
  /// TODO(B-1): today this reaches a no-op registrar, so muting is enforced
  /// only by [_shouldDisplay] on this device. Once B-1 exists the same call
  /// becomes the server-side opt-out P0-10 asks for.
  Future<void> syncPreferences() async {
    final String? token = _token;
    if (token == null) return;
    await _registrar.register(
      token: token,
      mutedCategories: await _preferences.mutedCategories(),
    );
  }

  /// Called on sign-out. Drops the token so the next customer on this handset
  /// does not inherit the last one's order updates.
  Future<void> disable() async {
    final String? token = _token;
    _token = null;
    if (token != null) {
      await _registrar.deregister(token: token);
    }
    if (!FirebaseBootstrap.isAvailable) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (error) {
      developer.log('Token delete failed: $error', name: 'optex.engagement');
    }
  }

  Future<void> dispose() async {
    await _foregroundSub?.cancel();
    await _openedSub?.cancel();
    await _tokenSub?.cancel();
    _foregroundSub = null;
    _openedSub = null;
    _tokenSub = null;
    _started = false;
  }

  // --- internals -----------------------------------------------------------

  Future<void> _initialiseLocalNotifications() async {
    const InitializationSettings settings = InitializationSettings(
      // The launcher icon the manifest already declares. A dedicated
      // monochrome notification icon would be nicer on Android and is a design
      // task, not a code one.
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      // All three false: permission is requested in context by
      // [requestPermission], not as a side effect of initialisation.
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );

    await _local.initialize(
      settings: settings,
      onDidReceiveNotificationResponse: _onLocalNotificationTapped,
    );

    final AndroidFlutterLocalNotificationsPlugin? android = _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (android == null) return;

    // One channel per category, so the system settings screen offers the same
    // three switches the app does and a customer can mute from either side.
    for (final NotificationCategory category in NotificationCategory.values) {
      await android.createNotificationChannel(
        AndroidNotificationChannel(
          _channelIdFor(category),
          category.label,
          description: _channelDescriptionFor(category),
          importance: Importance.high,
        ),
      );
    }
    await android.createNotificationChannel(
      const AndroidNotificationChannel(
        _fallbackChannelId,
        'Updates',
        description: 'General updates from Optex Opticians.',
        importance: Importance.defaultImportance,
      ),
    );
  }

  Future<void> _captureColdStartTap(FirebaseMessaging messaging) async {
    // A tap that launched the app from terminated. This is the case naive
    // implementations miss: `onMessageOpenedApp` never fires for it.
    final RemoteMessage? initial = await messaging.getInitialMessage();
    if (initial != null) {
      _pendingRoute = PushPayload.fromData(initial.data).route;
      if (_pendingRoute != null) _onDeepLink(_pendingRoute!);
      return;
    }

    // And a tap on a notification *we* posted (foreground display) that was
    // still in the tray when the app was killed and relaunched.
    final NotificationAppLaunchDetails? launch = await _local
        .getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp ?? false) {
      final String? route = PushPayload.decode(
        launch?.notificationResponse?.payload,
      )?.route;
      if (route != null) {
        _pendingRoute = route;
        _onDeepLink(route);
      }
    }
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final PushPayload payload = PushPayload.fromData(message.data);
    if (!await _shouldDisplay(payload.category)) return;

    final RemoteNotification? notification = message.notification;
    final String? title = notification?.title ?? payload.title;
    final String? body = notification?.body ?? payload.body;
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      // A data-only message with nothing to show. Nothing to do until B-1
      // defines what such a message would mean.
      return;
    }

    final String channelId = payload.category == null
        ? _fallbackChannelId
        : _channelIdFor(payload.category!);

    try {
      await _local.show(
        id: _notificationId(message),
        title: title,
        body: body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            payload.category?.label ?? 'Updates',
            channelDescription: _channelDescriptionFor(payload.category),
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: payload.encode(),
      );
    } catch (error) {
      developer.log(
        'Foreground notification display failed: $error',
        name: 'optex.engagement',
      );
    }
  }

  void _onMessageOpened(RemoteMessage message) {
    final String? route = PushPayload.fromData(message.data).route;
    if (route != null) _onDeepLink(route);
  }

  void _onLocalNotificationTapped(NotificationResponse response) {
    final String? route = PushPayload.decode(response.payload)?.route;
    if (route != null) _onDeepLink(route);
  }

  Future<void> _onTokenRefresh(String token) async {
    _token = token;
    await _registrar.register(
      token: token,
      mutedCategories: await _preferences.mutedCategories(),
    );
  }

  Future<bool> _shouldDisplay(NotificationCategory? category) async {
    if (category == null) return true;
    return !await _preferences.isMuted(category);
  }

  static PushPermission _map(AuthorizationStatus status) => switch (status) {
    AuthorizationStatus.authorized => PushPermission.granted,
    AuthorizationStatus.provisional => PushPermission.provisional,
    AuthorizationStatus.denied => PushPermission.denied,
    AuthorizationStatus.deniedPermanently => PushPermission.permanentlyDenied,
    AuthorizationStatus.notDetermined => PushPermission.notDetermined,
  };

  /// Android notification ids are 32-bit; a message id hashes into range.
  static int _notificationId(RemoteMessage message) =>
      (message.messageId ?? '${DateTime.now().microsecondsSinceEpoch}').hashCode
          .abs()
          .remainder(2147483647);

  static const String _fallbackChannelId = 'optex_updates';

  static String _channelIdFor(NotificationCategory category) =>
      'optex_${category.wire}';

  static String _channelDescriptionFor(NotificationCategory? category) =>
      switch (category) {
        NotificationCategory.order =>
          'Order confirmations and delivery updates.',
        NotificationCategory.appointment =>
          'Appointment confirmations and reminders.',
        NotificationCategory.offer => 'Offers and promotions from Optex.',
        null => 'General updates from Optex Opticians.',
      };
}
