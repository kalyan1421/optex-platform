import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';

/// Root of the Care tab.
///
/// Exists because the three clinical surfaces — book an eye test, send a
/// prescription, fill the intake form — had no shared entry point and sat
/// several taps deep inside Account. They are the reason this is an
/// optician's app rather than a shop.
class CareHubScreen extends ConsumerWidget {
  const CareHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final bool signedIn = ref.watch(authControllerProvider).isAuthenticated;

    return Scaffold(
      appBar: AppBar(title: const Text('Eye care')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: <Widget>[
          Text(
            'Everything for your eyes',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            signedIn
                ? 'Book a test, send us a prescription, or tell us your history before you arrive.'
                : 'Sign in to book a test and send us your prescription.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _CareCard(
            icon: Icons.event_available_rounded,
            title: 'Book an eye test',
            body: 'Pick a branch, a day and a time that suits you.',
            onTap: () => context.go(Routes.appointments),
          ),
          const SizedBox(height: AppSpacing.md),
          _CareCard(
            icon: Icons.photo_camera_rounded,
            title: 'Send a prescription',
            body: 'Photograph the paper one — we will do the rest.',
            onTap: () => context.go(Routes.prescriptions),
          ),
          const SizedBox(height: AppSpacing.md),
          _CareCard(
            icon: Icons.assignment_outlined,
            title: 'Your eye health',
            body: 'Fill this in before your visit to make it shorter.',
            onTap: () => context.go(Routes.eyeCare),
          ),
        ],
      ),
    );
  }
}

class _CareCard extends StatelessWidget {
  const _CareCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: <Widget>[
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: theme.colorScheme.primary),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      body,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: theme.colorScheme.outline,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
