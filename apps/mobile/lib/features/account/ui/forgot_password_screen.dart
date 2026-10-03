import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import 'widgets/auth_scaffold.dart';
import 'widgets/validators.dart';

/// Password-reset request.
///
/// `POST /auth/forgot-password` always returns the same 200 whether or not the
/// address is registered — GoTrue's own behaviour, which the API deliberately
/// does not layer a leak on top of. The confirmation copy here matches that:
/// it says a link *was sent if an account exists*, never "no such account".
///
/// KNOWN GAP: the reset link itself points at the **storefront**. The API
/// builds `redirect_to` from the server-side `WEB_APP_URL`
/// (`auth-flow.service.ts#resetRedirectUrl`), so it can only ever be
/// `https://<web>/reset-password` — there is no `optex://` variant and no way
/// for a client to ask for one. A customer who starts a reset in the app
/// therefore finishes it in a browser. See the report notes.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();

  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref
          .read(authRepositoryProvider)
          .requestPasswordReset(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      // Only a transport/throttle failure reaches here — the endpoint itself
      // succeeds regardless of whether the address exists.
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    if (_sent) {
      return AuthScaffold(
        title: 'Check your email',
        subtitle:
            'If an account exists for ${_email.text.trim()}, '
            'a reset link is on its way.',
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  Icons.open_in_browser_rounded,
                  size: 20,
                  color: theme.colorScheme.outline,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'The link opens in your browser. Once you have set a new '
                    'password, come back here and sign in with it.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            // Reachable by deep link as well as from login, so popping is not
            // always possible.
            onPressed: () =>
                context.canPop() ? context.pop() : context.go(Routes.login),
            child: const Text('Back to sign in'),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: () => setState(() => _sent = false),
            child: const Text('Use a different email'),
          ),
        ],
      );
    }

    return AuthScaffold(
      title: 'Reset your password',
      subtitle:
          'Enter the email on your account and we will send a reset link.',
      children: <Widget>[
        if (_error != null) FormErrorBanner(message: _error!),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _email,
                autofillHints: const <String>[AutofillHints.email],
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autocorrect: false,
                enabled: !_submitting,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'you@example.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
                validator: Validators.email,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Send reset link'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
