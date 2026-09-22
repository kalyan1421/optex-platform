import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/profile.dart';
import '../state/account_providers.dart';
import 'widgets/auth_scaffold.dart';
import 'widgets/validators.dart';

/// View and edit `GET`/`PATCH /me`.
///
/// Email is displayed but not editable: `UpdateMeDto` accepts `full_name` and
/// `phone` only, and the address on the account is the auth identity — moving
/// it is a Supabase Auth operation the API does not expose.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<MeProfile> profile = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: profile.when(
        loading: () => const AppLoading(label: 'Loading your profile…'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.read(profileProvider.notifier).refresh(),
        ),
        data: (MeProfile value) => _ProfileForm(profile: value),
      ),
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.profile});

  final MeProfile profile;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _name =
      TextEditingController(text: widget.profile.fullName ?? '');
  late final TextEditingController _phone =
      TextEditingController(text: widget.profile.phone ?? '');

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  bool get _dirty =>
      _name.text.trim() != (widget.profile.fullName ?? '').trim() ||
      _phone.text.trim() != (widget.profile.phone ?? '').trim();

  Future<void> _save() async {
    if (_saving) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });

    // Spaces are allowed while typing ("0712 345 678" is how people write it)
    // but `UpdateMeDto`'s regex has no room for them, so they come out here.
    final String phone = _phone.text.replaceAll(' ', '').trim();
    try {
      await ref.read(profileProvider.notifier).save(
            fullName: _name.text.trim(),
            phone: phone.isEmpty ? null : phone,
            // An emptied field is an explicit "remove my number", which the
            // service only performs when the key is present and null.
            clearPhone: phone.isEmpty && (widget.profile.phone ?? '').isNotEmpty,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated')),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xl + MediaQuery.viewInsetsOf(context).bottom,
      ),
      children: <Widget>[
        if (_error != null) FormErrorBanner(message: _error!),
        if (!widget.profile.hasProfile)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              'Finish setting up your profile so we can reach you about '
              'orders and appointments.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
          ),
        _ReadOnlyField(
          label: 'Email',
          value: widget.profile.email ?? 'Not set',
          helper: 'Your email is your sign-in and cannot be changed here.',
        ),
        const SizedBox(height: AppSpacing.md),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                enabled: !_saving,
                autofillHints: const <String>[AutofillHints.name],
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline_rounded),
                ),
                validator: Validators.fullName,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                enabled: !_saving,
                autofillHints: const <String>[AutofillHints.telephoneNumber],
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
                  LengthLimitingTextInputFormatter(16),
                ],
                decoration: const InputDecoration(
                  labelText: 'Phone (optional)',
                  hintText: '0712345678',
                  helperText: 'Kenyan mobile number. Used for delivery and '
                      'appointment reminders.',
                  helperMaxLines: 2,
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                validator: Validators.optionalKenyanPhone,
                onChanged: (_) => setState(() {}),
                onFieldSubmitted: (_) => _save(),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: (!_dirty || _saving) ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Save changes'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({
    required this.label,
    required this.value,
    this.helper,
  });

  final String label;
  final String value;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
        helperMaxLines: 2,
        prefixIcon: const Icon(Icons.mail_outline_rounded),
        enabled: false,
      ),
      child: Text(
        value,
        style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.outline),
      ),
    );
  }
}
