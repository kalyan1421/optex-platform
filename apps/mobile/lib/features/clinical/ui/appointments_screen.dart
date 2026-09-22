import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/appointment.dart';
import '../domain/clinic_branch.dart';
import '../domain/nairobi_time.dart';
import '../state/appointments_providers.dart';
import 'reschedule_sheet.dart';
import 'widgets/clinical_chrome.dart';

/// The customer's own bookings, upcoming first.
class AppointmentsScreen extends ConsumerWidget {
  const AppointmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Appointment>> async = ref.watch(appointmentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My appointments')),
      floatingActionButton: async.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => context.push(Routes.appointmentBooking),
              icon: const Icon(Icons.event_available_outlined),
              label: const Text('Book'),
            )
          : null,
      body: async.when(
        loading: () => const AppLoading(label: 'Loading your appointments'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.invalidate(appointmentsProvider),
        ),
        data: (List<Appointment> all) {
          final List<Appointment> upcoming = all
              .where((Appointment a) => a.isUpcoming)
              .toList();
          final List<Appointment> rest =
              all
                  .where((Appointment a) => !a.isUpcoming)
                  // Past and closed bookings read best newest-first; the API sorts
                  // everything ascending for the upcoming case.
                  .toList()
                ..sort(
                  (Appointment a, Appointment b) =>
                      b.scheduledAt.compareTo(a.scheduledAt),
                );

          return RefreshIndicator(
            onRefresh: () async => ref.refresh(appointmentsProvider.future),
            child: all.isEmpty
                ? _Empty(onBook: () => context.push(Routes.appointmentBooking))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.xxl + AppSpacing.lg,
                    ),
                    children: <Widget>[
                      if (upcoming.isNotEmpty) ...<Widget>[
                        _SectionHeading(
                          label: 'Coming up',
                          count: upcoming.length,
                        ),
                        for (final Appointment appointment in upcoming)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: _AppointmentCard(appointment: appointment),
                          ),
                      ],
                      if (rest.isNotEmpty) ...<Widget>[
                        const SizedBox(height: AppSpacing.sm),
                        _SectionHeading(label: 'Past', count: rest.length),
                        for (final Appointment appointment in rest)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: _AppointmentCard(appointment: appointment),
                          ),
                      ],
                    ],
                  ),
          );
        },
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onBook});

  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
    children: <Widget>[
      AppEmptyState(
        title: 'No appointments yet',
        message:
            'Eye tests at Optex are free. Pick a branch and a time '
            'that suits you.',
        icon: Icons.event_outlined,
        action: FilledButton.icon(
          onPressed: onBook,
          icon: const Icon(Icons.event_available_outlined),
          label: const Text('Book a visit'),
        ),
      ),
    ],
  );
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Text(
      '$label ($count)',
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: Theme.of(context).colorScheme.outline,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
      ),
    ),
  );
}

class _AppointmentCard extends ConsumerWidget {
  const _AppointmentCard({required this.appointment});

  final Appointment appointment;

  StatusTone get _tone => switch (appointment.status) {
    AppointmentStatus.confirmed => StatusTone.positive,
    AppointmentStatus.cancelled => StatusTone.muted,
    AppointmentStatus.completed => StatusTone.muted,
    AppointmentStatus.pending => StatusTone.progress,
    AppointmentStatus.rescheduled => StatusTone.progress,
    AppointmentStatus.unknown => StatusTone.neutral,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final bool acting = ref.watch(appointmentActionsProvider);
    final String? blocked = appointment.changeBlockedReason;

    // Branch names are not on the appointment row, so they are resolved from
    // the branch list. Unresolved is fine — the time is the thing that matters
    // and it never waits on a second request.
    final String? branchName = ref
        .watch(clinicBranchesProvider)
        .maybeWhen(
          data: (List<ClinicBranch> branches) => branches
              .where((ClinicBranch b) => b.id == appointment.branchId)
              .map((ClinicBranch b) => b.name)
              .firstOrNull,
          orElse: () => null,
        );

    return ClinicalCard(
      title: appointment.type.label,
      trailing: StatusPill(label: appointment.status.label, tone: _tone),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(
                Icons.schedule_rounded,
                size: 18,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  formatAppointmentStamp(appointment.scheduledAt),
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.lg + AppSpacing.xs),
            child: Text(
              // The time shown is always branch time, so say so once rather
              // than let a travelling customer wonder.
              '${appointment.isUpcoming ? formatRelative(appointment.scheduledAt) : formatLongDate(appointment.scheduledAt)}'
              ' · Nairobi time',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
          if (branchName != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: <Widget>[
                Icon(
                  Icons.place_outlined,
                  size: 18,
                  color: theme.colorScheme.outline,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(branchName, style: theme.textTheme.bodyMedium),
                ),
              ],
            ),
          ],

          // The device-calendar action that is deliberately absent.
          //
          // TODO(core): "add to calendar" needs a calendar plugin
          // (`add_2_calendar` for a one-shot hand-off to the OS calendar app,
          // or `device_calendar` for writing directly). Neither is in
          // `pubspec.yaml`, and this slice may not add a dependency, so the
          // affordance is left out rather than shipped as a button that does
          // nothing. Everything it needs is already here: `scheduledAt` is the
          // exact UTC instant, the type gives the title and the branch gives
          // the location.
          if (blocked != null) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            InlineNotice(
              tone: StatusTone.muted,
              icon: Icons.info_outline_rounded,
              message: blocked,
            ),
          ],

          if (appointment.canCancel || appointment.canReschedule) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    // Shown-but-disabled rather than hidden: a customer looking
                    // for "move this" must find out why it is unavailable, not
                    // conclude the app cannot do it. The reason is spelled out
                    // in the notice directly above.
                    onPressed: acting || !appointment.canReschedule
                        ? null
                        : () => openRescheduleSheet(context, appointment),
                    icon: const Icon(Icons.edit_calendar_outlined, size: 18),
                    label: const Text('Reschedule'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: TextButton.icon(
                    onPressed: acting || !appointment.canCancel
                        ? null
                        : () => _confirmCancel(context, ref),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Cancel'),
                    style: TextButton.styleFrom(
                      foregroundColor: theme.colorScheme.error,
                      minimumSize: const Size.fromHeight(
                        AppSpacing.minTapTarget,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    final bool confirmed =
        await showDialog<bool>(
          context: context,
          builder: (BuildContext context) => AlertDialog(
            title: const Text('Cancel this appointment?'),
            content: Text(
              'Your ${appointment.type.label.toLowerCase()} on '
              '${formatLongDate(appointment.scheduledAt)} at '
              '${formatSlotLabel(appointment.timeKey)} will be released for '
              'someone else. You can always book again.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Keep it'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Cancel appointment'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed || !context.mounted) return;

    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final String? error = await ref
        .read(appointmentActionsProvider.notifier)
        .cancel(appointment.id);

    messenger.showSnackBar(
      SnackBar(content: Text(error ?? 'Appointment cancelled.')),
    );
  }
}
