import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../domain/profile.dart';
import '../state/account_providers.dart';

/// The account tab: one place that leads everywhere personal.
///
/// The targets belong to other feature slices that are being built in
/// parallel, so every destination is a `Routes` constant and nothing here
/// imports another slice. A route whose screen has not landed yet falls
/// through to the router's own placeholder, which is the intended behaviour
/// during integration.
class AccountHubScreen extends ConsumerWidget {
  const AccountHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<MeProfile> profile = ref.watch(profileProvider);
    final AuthState auth = ref.watch(authControllerProvider);

    // The profile is the better name source (it reflects an edit made on this
    // device), but the token identity is already in memory, so it carries the
    // header while /me loads rather than leaving a blank bar.
    final String name =
        profile.value?.displayName ?? auth.user?.displayName ?? 'Your account';
    final String? email = profile.value?.email ?? auth.user?.email;
    final String initials =
        profile.value?.initials ??
        (name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?');

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(profileProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.xl),
          children: <Widget>[
            _Header(name: name, email: email, initials: initials),
            const SizedBox(height: AppSpacing.sm),
            const _SectionLabel('Shopping'),
            _HubTile(
              icon: Icons.receipt_long_outlined,
              title: 'My orders',
              subtitle: 'Track deliveries and past purchases',
              onTap: () => context.push(Routes.orders),
            ),
            _HubTile(
              icon: Icons.favorite_border_rounded,
              title: 'Wishlist',
              subtitle: 'Frames you saved for later',
              onTap: () => context.push(Routes.wishlist),
            ),
            _HubTile(
              icon: Icons.location_on_outlined,
              title: 'Delivery addresses',
              subtitle: 'Where your orders are sent',
              onTap: () => context.push(Routes.addresses),
            ),
            const _SectionLabel('Eye care'),
            _HubTile(
              icon: Icons.description_outlined,
              title: 'Prescriptions',
              subtitle: 'Upload and review your prescriptions',
              onTap: () => context.push(Routes.prescriptions),
            ),
            _HubTile(
              icon: Icons.event_available_outlined,
              title: 'Appointments',
              subtitle: 'Book or manage an eye test',
              onTap: () => context.push(Routes.appointments),
            ),
            _HubTile(
              icon: Icons.storefront_outlined,
              title: 'Find a branch',
              subtitle: 'Opening hours, directions and phone numbers',
              onTap: () => context.push(Routes.branches),
            ),
            const _SectionLabel('You'),
            _HubTile(
              icon: Icons.person_outline_rounded,
              title: 'Profile',
              subtitle: 'Name and contact number',
              onTap: () => context.push(Routes.profile),
            ),
            _HubTile(
              icon: Icons.notifications_none_rounded,
              title: 'Notifications',
              onTap: () => context.push(Routes.notifications),
            ),
            _HubTile(
              icon: Icons.settings_outlined,
              title: 'Settings',
              onTap: () => context.push(Routes.settings),
            ),
            const SizedBox(height: AppSpacing.lg),
            const _SignOutTile(),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.email,
    required this.initials,
  });

  final String name;
  final String? email;
  final String initials;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          CircleAvatar(
            radius: 28,
            backgroundColor: theme.colorScheme.primary,
            child: Text(
              initials,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  name,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (email != null)
                  Text(
                    email!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Text(
        label.toUpperCase(),
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.outline,
          letterSpacing: 1.1,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _HubTile extends StatelessWidget {
  const _HubTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ListTile(
      minTileHeight: AppSpacing.minTapTarget + AppSpacing.sm,
      leading: Icon(icon, color: theme.colorScheme.primary),
      title: Text(title, style: theme.textTheme.bodyLarge),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}

/// Sign-out. No navigation afterwards: `/account` is in the router's protected
/// list, so clearing the session makes the redirect move the user itself.
class _SignOutTile extends ConsumerStatefulWidget {
  const _SignOutTile();

  @override
  ConsumerState<_SignOutTile> createState() => _SignOutTileState();
}

class _SignOutTileState extends ConsumerState<_SignOutTile> {
  bool _busy = false;

  Future<void> _confirmAndSignOut() async {
    final bool confirmed =
        await showDialog<bool>(
          context: context,
          builder: (BuildContext ctx) => AlertDialog(
            title: const Text('Sign out?'),
            content: const Text(
              'Your saved items and orders stay on your account. '
              'You will need to sign in again to see them.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Stay signed in'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Sign out'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed || !mounted) return;

    setState(() => _busy = true);
    // `logout()` is best-effort server-side but always clears local storage,
    // so this cannot fail in a way that leaves a usable token on the device.
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ListTile(
      minTileHeight: AppSpacing.minTapTarget,
      leading: _busy
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(Icons.logout_rounded, color: theme.colorScheme.error),
      title: Text(
        'Sign out',
        style: theme.textTheme.bodyLarge?.copyWith(
          color: theme.colorScheme.error,
        ),
      ),
      onTap: _busy ? null : _confirmAndSignOut,
    );
  }
}
