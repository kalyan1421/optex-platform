import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/branch.dart';
import '../state/branch_providers.dart';

/// Branch locator (P0-7).
///
/// Distance sorting is an enhancement layered on top of a list that always
/// works. Nothing here waits on a permission, nothing is hidden behind one,
/// and every refusal path ends somewhere the customer can act — which is what
/// "denial is never a blocker" has to mean in practice.
class BranchLocatorScreen extends ConsumerWidget {
  const BranchLocatorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<BranchLocatorState> locator = ref.watch(
      branchLocatorProvider,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Our branches')),
      body: locator.when(
        loading: () => const AppLoading(label: 'Finding branches…'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.read(branchLocatorProvider.notifier).refresh(),
        ),
        data: (BranchLocatorState state) {
          if (state.branches.isEmpty) {
            return AppEmptyState(
              title: 'No branches listed',
              message:
                  'We could not find any open branches right now. '
                  'Please try again shortly.',
              icon: Icons.storefront_outlined,
              action: OutlinedButton.icon(
                onPressed: () =>
                    ref.read(branchLocatorProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Try again'),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(branchLocatorProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xl,
              ),
              itemCount: state.branches.length + 1,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (BuildContext context, int index) {
                if (index == 0) return _LocationBanner(state: state);
                return _BranchCard(entry: state.branches[index - 1]);
              },
            ),
          );
        },
      ),
    );
  }
}

/// Explains the current sort order and offers the one action that can change
/// it. Never a dead end: a permanent denial gets a settings shortcut, a
/// missing fix gets a retry, and a plain refusal simply says the list stays
/// alphabetical.
class _LocationBanner extends ConsumerWidget {
  const _LocationBanner({required this.state});

  final BranchLocatorState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final BranchLocatorController controller = ref.read(
      branchLocatorProvider.notifier,
    );

    final (
      IconData icon,
      String message,
      String? actionLabel,
      VoidCallback? action,
    ) = switch (state.access) {
      LocationAccess.granted => (
        Icons.near_me_rounded,
        'Sorted by distance from you.',
        null,
        null,
      ),
      LocationAccess.notAsked => (
        Icons.sort_by_alpha_rounded,
        'Listed A–Z. Share your location to see the nearest branch first.',
        'Sort by nearest',
        controller.requestLocation,
      ),
      LocationAccess.denied => (
        Icons.sort_by_alpha_rounded,
        'Listed A–Z. You can still call or get directions to any branch.',
        'Try location again',
        controller.requestLocation,
      ),
      LocationAccess.deniedForever => (
        Icons.sort_by_alpha_rounded,
        'Listed A–Z. Location is turned off for OPTEX in your device '
            'settings.',
        'Open settings',
        () => controller.openSettings(locationServices: false),
      ),
      LocationAccess.serviceDisabled => (
        Icons.location_disabled_rounded,
        'Listed A–Z. Location services are switched off on this device.',
        'Turn on location',
        () => controller.openSettings(locationServices: true),
      ),
      LocationAccess.unavailable => (
        Icons.sort_by_alpha_rounded,
        'Listed A–Z. We could not get a location fix just now.',
        'Try again',
        controller.requestLocation,
      ),
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  message,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
                if (actionLabel != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.xs),
                  state.locating
                      ? const Padding(
                          padding: EdgeInsets.symmetric(
                            vertical: AppSpacing.sm,
                          ),
                          child: SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : TextButton(
                          onPressed: action,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(0, AppSpacing.xl),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(actionLabel),
                        ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BranchCard extends StatefulWidget {
  const _BranchCard({required this.entry});

  final BranchDistance entry;

  @override
  State<_BranchCard> createState() => _BranchCardState();
}

class _BranchCardState extends State<_BranchCard> {
  bool _hoursExpanded = false;

  Branch get _branch => widget.entry.branch;

  void _report(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  /// `canLaunchUrl` is deliberately not consulted. On Android 11+ it needs a
  /// `<queries>` entry for `tel:`/`geo:` in the manifest — which this slice
  /// must not edit — and returns false without one even though the launch
  /// itself would succeed. Attempting the launch and handling the failure is
  /// both more honest and more portable.
  Future<bool> _tryLaunch(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  Future<void> _dial() async {
    final String? phone = _branch.phone;
    if (phone == null || phone.trim().isEmpty) return;
    final Uri uri = Uri(
      scheme: 'tel',
      path: phone.replaceAll(RegExp(r'[\s()-]'), ''),
    );
    if (!await _tryLaunch(uri)) {
      _report('No dialler available. The number is $phone.');
    }
  }

  /// Apple Maps on iOS, the `geo:` chooser on Android, and a Google Maps web
  /// URL as the fallback for both — so a device with no map app still ends up
  /// looking at the right place in a browser.
  Future<void> _openMap() async {
    final String query = _branch.address?.trim().isNotEmpty ?? false
        ? '${_branch.name}, ${_branch.address}'
        : _branch.name;
    final String encoded = Uri.encodeComponent(query);

    final List<Uri> candidates = <Uri>[
      if (_branch.hasCoordinates)
        if (!kIsWeb && Platform.isIOS)
          Uri.parse(
            'https://maps.apple.com/?ll=${_branch.lat},${_branch.lng}&q=$encoded',
          )
        else
          Uri.parse(
            'geo:${_branch.lat},${_branch.lng}?q=${_branch.lat},${_branch.lng}($encoded)',
          ),
      Uri.parse(
        _branch.hasCoordinates
            ? 'https://www.google.com/maps/search/?api=1&query=${_branch.lat},${_branch.lng}'
            : 'https://www.google.com/maps/search/?api=1&query=$encoded',
      ),
    ];

    for (final Uri uri in candidates) {
      if (await _tryLaunch(uri)) return;
    }
    _report('Could not open a map app for this branch.');
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Branch branch = _branch;
    final String? distance = widget.entry.distanceLabel;
    final bool? openNow = branch.hours.isOpenAt(DateTime.now());
    final bool hasAddress = branch.address?.trim().isNotEmpty ?? false;
    final bool hasPhone = branch.phone?.trim().isNotEmpty ?? false;
    final DayHours? today = branch.hours.forWeekday(DateTime.now().weekday);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Text(
                    branch.name,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (openNow != null) _OpenChip(open: openNow),
              ],
            ),
            if (distance != null) ...<Widget>[
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: <Widget>[
                  Icon(
                    Icons.near_me_outlined,
                    size: 14,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    distance,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
            if (hasAddress) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              InkWell(
                onTap: _openMap,
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Icon(
                        Icons.place_outlined,
                        size: 18,
                        color: theme.colorScheme.outline,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          branch.address!,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 16,
                        color: theme.colorScheme.outline,
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (hasPhone) ...<Widget>[
              InkWell(
                onTap: _dial,
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Row(
                    children: <Widget>[
                      Icon(
                        Icons.phone_outlined,
                        size: 18,
                        color: theme.colorScheme.outline,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          branch.phone!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.call_made_rounded,
                        size: 16,
                        color: theme.colorScheme.outline,
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xs),
            if (branch.hours.isEmpty)
              Row(
                children: <Widget>[
                  Icon(
                    Icons.schedule_outlined,
                    size: 18,
                    color: theme.colorScheme.outline,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Call for opening hours',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              )
            else
              _HoursSection(
                hours: branch.hours,
                today: today,
                expanded: _hoursExpanded,
                onToggle: () =>
                    setState(() => _hoursExpanded = !_hoursExpanded),
              ),
          ],
        ),
      ),
    );
  }
}

class _OpenChip extends StatelessWidget {
  const _OpenChip({required this.open});

  final bool open;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color color = open
        ? theme.colorScheme.primary
        : theme.colorScheme.error;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        open ? 'Open now' : 'Closed',
        style: theme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _HoursSection extends StatelessWidget {
  const _HoursSection({
    required this.hours,
    required this.today,
    required this.expanded,
    required this.onToggle,
  });

  final BranchHours hours;
  final DayHours? today;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final int weekday = DateTime.now().weekday;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: <Widget>[
                Icon(
                  Icons.schedule_outlined,
                  size: 18,
                  color: theme.colorScheme.outline,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Today: ${today?.display ?? 'Closed'}',
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                Icon(
                  expanded
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  size: 20,
                  color: theme.colorScheme.outline,
                ),
              ],
            ),
          ),
        ),
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.lg + AppSpacing.xs),
            child: Column(
              children: <Widget>[
                for (final (int day, DayHours? dayHours) in hours.week)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      children: <Widget>[
                        SizedBox(
                          width: 92,
                          child: Text(
                            BranchHours.labelFor(day),
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: day == weekday
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            dayHours?.display ?? 'Closed',
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontWeight: day == weekday
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
