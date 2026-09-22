import 'dart:developer' as developer;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/version_gate.dart';

/// Opens the store listing the served config points at.
///
/// The URL comes from Remote Config, never from a constant here: the store
/// links do not exist yet (SPEC-11 Q1/Q2 — neither developer account is
/// created), and a baked-in link would be one more thing that cannot be fixed
/// without a release.
Future<void> openStore(String? storeUrl) async {
  final Uri? uri = storeUrl == null ? null : Uri.tryParse(storeUrl);
  if (uri == null || !uri.hasScheme) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (error) {
    developer.log('Could not open $uri: $error', name: 'optex.engagement');
  }
}

/// The dismissible "update available" prompt — the default for every release.
///
/// A card at the bottom rather than a modal: it must not stand between the
/// customer and whatever they opened the app to do.
class UpdatePromptCard extends StatelessWidget {
  const UpdatePromptCard({
    super.key,
    required this.decision,
    required this.onDismiss,
  });

  final VersionGateDecision decision;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return SafeArea(
      minimum: const EdgeInsets.all(AppSpacing.md),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(Icons.system_update_rounded,
                      size: 20, color: theme.colorScheme.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'A new version is available',
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                decision.message ??
                    'Update to get the latest fixes and improvements.',
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onDismiss,
                      child: const Text('Later'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: FilledButton(
                      onPressed: decision.storeUrl == null
                          ? null
                          : () => openStore(decision.storeUrl),
                      child: const Text('Update'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The non-dismissible block. P0-14 reserves it for three causes only — a
/// security fix, a payment-correctness bug, or removal of an API this version
/// depends on — and it is driven entirely by `minSupportedVersion` in Remote
/// Config, so raising or lowering it is a console change, not a release.
///
/// There is deliberately no back affordance and no `PopScope` escape: a build
/// that is genuinely unsafe to transact on should not be reachable around the
/// edges of this screen.
class UnsupportedVersionScreen extends StatelessWidget {
  const UnsupportedVersionScreen({super.key, required this.decision});

  final VersionGateDecision decision;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return PopScope(
      canPop: false,
      child: Scaffold(
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.system_update_rounded,
                    size: 56, color: theme.colorScheme.primary),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Update required',
                  style: theme.textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  decision.message ??
                      'This version of the app is no longer supported. '
                          'Please update to continue.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (decision.storeUrl != null)
                  FilledButton.icon(
                    onPressed: () => openStore(decision.storeUrl),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: const Text('Update now'),
                  )
                else
                  // No store URL in the served config. Saying so is better than
                  // a button that does nothing.
                  Text(
                    'Please update from your app store.',
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Installed version ${decision.installedVersion}',
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
