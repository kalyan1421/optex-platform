import 'package:flutter/material.dart';

/// A ScaffoldMessenger reachable from outside the widget tree.
///
/// Most feedback belongs to the screen that caused it and should use
/// `ScaffoldMessenger.of(context)`. This exists for the handful of things that
/// happen with no screen of their own — the post-sign-in cart replay being the
/// one that prompted it, where the work is triggered by an auth state change
/// rather than by a tap.
final GlobalKey<ScaffoldMessengerState> appMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Shows [message], quietly doing nothing if no messenger is mounted.
///
/// Never throws: this is feedback, and feedback failing must not take down the
/// operation that was trying to report.
void showAppMessage(String message, {bool isError = false}) {
  final ScaffoldMessengerState? messenger = appMessengerKey.currentState;
  if (messenger == null) return;

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        duration: Duration(seconds: isError ? 5 : 3),
      ),
    );
}
