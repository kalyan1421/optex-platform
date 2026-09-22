import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_models.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import 'widgets/auth_scaffold.dart';
import 'widgets/social_auth_buttons.dart';
import 'widgets/validators.dart';

/// Account creation.
///
/// Two outcomes are both successes. When the API returns a session the router
/// redirect takes over and this screen disappears. When email confirmation is
/// enabled it returns a user and a **null session**
/// ([AuthResult.needsEmailConfirmation]) — the account exists, it just is not
/// signed in yet, and showing that as a failure would have people signing up
/// twice.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key, this.from});

  final String? from;

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  bool _obscure = true;
  bool _submitting = false;
  bool _socialBusy = false;
  String? _error;
  String? _confirmationEmail;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting || _socialBusy) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final AuthResult result = await ref.read(authControllerProvider.notifier).signup(
            _email.text.trim(),
            _password.text,
            _name.text.trim(),
          );
      if (!mounted) return;
      if (result.needsEmailConfirmation) {
        setState(() => _confirmationEmail = result.user.email ?? _email.text.trim());
      }
      // Otherwise a session was adopted and the router redirect navigates.
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _goToLogin() {
    final String? from = widget.from;
    final String target =
        from == null || from.isEmpty ? Routes.login : '${Routes.login}?from=$from';
    // Replace rather than push: arriving here from login and then pushing
    // login again would build a stack the back button walks in circles.
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_confirmationEmail != null) {
      return _CheckYourInbox(
        email: _confirmationEmail!,
        onBackToSignIn: _goToLogin,
      );
    }

    final ThemeData theme = Theme.of(context);
    final bool busy = _submitting || _socialBusy;

    return AuthScaffold(
      title: 'Create your account',
      subtitle: 'One account for orders, prescriptions and appointments.',
      children: <Widget>[
        if (_error != null) FormErrorBanner(message: _error!),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _name,
                autofillHints: const <String>[AutofillHints.name],
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                enabled: !busy,
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: Validators.fullName,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _email,
                autofillHints: const <String>[AutofillHints.email],
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                enabled: !busy,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  hintText: 'you@example.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
                validator: Validators.email,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _password,
                autofillHints: const <String>[AutofillHints.newPassword],
                obscureText: _obscure,
                textInputAction: TextInputAction.next,
                enabled: !busy,
                decoration: InputDecoration(
                  labelText: 'Password',
                  helperText: 'At least 8 characters',
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    tooltip: _obscure ? 'Show password' : 'Hide password',
                  ),
                ),
                validator: Validators.newPassword,
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _confirm,
                obscureText: _obscure,
                textInputAction: TextInputAction.done,
                enabled: !busy,
                decoration: const InputDecoration(
                  labelText: 'Confirm password',
                  prefixIcon: Icon(Icons.lock_outline_rounded),
                ),
                validator: (String? value) {
                  if ((value ?? '').isEmpty) return 'Re-enter your password';
                  if (value != _password.text) return 'Passwords do not match';
                  return null;
                },
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: busy ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Create account'),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SocialAuthButtons(
          onBusyChanged: (bool value) {
            if (mounted) setState(() => _socialBusy = value);
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'Already have an account?',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            TextButton(
              onPressed: busy ? null : _goToLogin,
              child: const Text('Sign in'),
            ),
          ],
        ),
      ],
    );
  }
}

/// Terminal success state for a signup that needs email confirmation.
class _CheckYourInbox extends StatelessWidget {
  const _CheckYourInbox({required this.email, required this.onBackToSignIn});

  final String email;
  final VoidCallback onBackToSignIn;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(
                  Icons.mark_email_unread_outlined,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Check your inbox',
                  style: theme.textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Your account is created. We sent a confirmation link to '
                  '$email — open it to finish signing in.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
                const SizedBox(height: AppSpacing.xl),
                FilledButton(
                  onPressed: onBackToSignIn,
                  child: const Text('Back to sign in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
