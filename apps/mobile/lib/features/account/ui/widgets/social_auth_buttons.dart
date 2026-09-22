import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/env/app_env.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/providers.dart';
import '../../../../core/theme/app_spacing.dart';

/// Google and Apple sign-in, shared by the login and signup screens.
///
/// Three behaviours are load-bearing here and easy to get wrong:
///
/// 1. **Cancellation is not an error.** `signInWithGoogle`/`signInWithApple`
///    return false when the user dismissed the provider sheet. Nothing is
///    shown — no snackbar, no banner (SPEC-11 P0-1 acceptance criteria).
/// 2. **Apple is iOS-only** — App Store Guideline 4.8 makes it mandatory
///    *because* we offer Google, but it has no meaning on Android.
/// 3. **Google is unconfigured in every build today.** No OAuth client IDs
///    have been issued (blocked on SPEC-11 Q1/Q2), so the button is disabled
///    with a quiet explanation rather than left to throw from inside the
///    plugin.
class SocialAuthButtons extends ConsumerStatefulWidget {
  const SocialAuthButtons({super.key, this.onBusyChanged});

  /// Lets the host form disable its own submit button while a provider sheet
  /// is up, so two sign-ins cannot be in flight at once.
  final ValueChanged<bool>? onBusyChanged;

  @override
  ConsumerState<SocialAuthButtons> createState() => _SocialAuthButtonsState();
}

enum _Provider { google, apple }

class _SocialAuthButtonsState extends ConsumerState<SocialAuthButtons> {
  _Provider? _busy;
  String? _error;

  bool get _showApple => !kIsWeb && Platform.isIOS;

  Future<void> _run(_Provider provider) async {
    if (_busy != null) return;
    setState(() {
      _busy = provider;
      _error = null;
    });
    widget.onBusyChanged?.call(true);

    try {
      // A false result means the sheet was dismissed. Deliberately silent:
      // the user knows they cancelled, and telling them so reads as a fault.
      // On success the router's redirect handles navigation.
      switch (provider) {
        case _Provider.google:
          await ref.read(authControllerProvider.notifier).signInWithGoogle();
        case _Provider.apple:
          await ref.read(authControllerProvider.notifier).signInWithApple();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      // Provider SDKs throw their own types; the repository normalises the
      // ones it knows about, and anything left is still not allowed to crash
      // the screen.
      if (mounted) {
        setState(() => _error = 'Sign-in could not be completed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = null);
      widget.onBusyChanged?.call(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool googleReady = AppEnv.googleSignInConfigured;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text(
                'or continue with',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (_error != null) ...<Widget>[
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        _ProviderButton(
          label: 'Continue with Google',
          icon: Icons.g_mobiledata_rounded,
          loading: _busy == _Provider.google,
          onPressed: googleReady && _busy == null
              ? () => _run(_Provider.google)
              : null,
        ),
        if (!googleReady) ...<Widget>[
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Google sign-in is not available in this build yet. '
            'Use your email and password for now.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.outline),
          ),
        ],
        if (_showApple) ...<Widget>[
          const SizedBox(height: AppSpacing.sm + AppSpacing.xs),
          _ProviderButton(
            label: 'Continue with Apple',
            icon: Icons.apple,
            loading: _busy == _Provider.apple,
            onPressed: _busy == null ? () => _run(_Provider.apple) : null,
          ),
        ],
      ],
    );
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({
    required this.label,
    required this.icon,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: loading ? null : onPressed,
      icon: loading
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, size: 22),
      label: Text(label),
    );
  }
}
