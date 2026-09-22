import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../data/contact_profile_repository.dart';
import '../domain/appointment.dart';
import '../domain/clinic_branch.dart';
import '../domain/nairobi_time.dart';
import '../state/appointments_providers.dart';
import '../state/clinical_providers.dart';
import 'widgets/clinical_chrome.dart';
import 'widgets/slot_pickers.dart';

/// The booking wizard: branch → service → day → time → confirm.
///
/// Mirrors the storefront's three-step flow but splits "when" into day and
/// time. On a phone a date strip and a slot grid cannot share a screen without
/// one of them becoming unusable, and cramming them together is how customers
/// end up tapping a date and not noticing the times below changed.
class AppointmentBookingScreen extends ConsumerStatefulWidget {
  const AppointmentBookingScreen({super.key});

  @override
  ConsumerState<AppointmentBookingScreen> createState() =>
      _AppointmentBookingScreenState();
}

class _AppointmentBookingScreenState
    extends ConsumerState<AppointmentBookingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // A finished booking left in the controller would otherwise greet the
      // next visit with somebody's old confirmation screen.
      if (ref.read(bookingControllerProvider).booked != null) {
        ref.read(bookingControllerProvider.notifier).reset();
      }
    });

    // Pre-fill contact details from the profile.
    //
    // `fireImmediately` is load-bearing, not tidiness: another screen may have
    // already resolved this provider, and a plain listener only fires on
    // *change* — so an already-cached profile would never reach the form and
    // the customer would retype their own name and number.
    ref.listenManual<AsyncValue<ContactProfile>>(contactProfileProvider, (
      AsyncValue<ContactProfile>? _,
      AsyncValue<ContactProfile> next,
    ) {
      final ContactProfile? profile = next.value;
      if (profile == null) return;
      ref
          .read(bookingControllerProvider.notifier)
          .prefill(name: profile.fullName, phone: profile.phone);
    }, fireImmediately: true);
  }

  void _close() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.appointments);
    }
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = ref.watch(bookingControllerProvider);
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );

    if (draft.booked != null) {
      return _BookedScreen(
        appointment: draft.booked!,
        branch: draft.branch,
        onDone: _close,
        onBookAnother: controller.reset,
      );
    }

    return PopScope(
      canPop: draft.step == BookingStep.branch,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (didPop) return;
        controller.back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Book a visit'),
          leading: IconButton(
            icon: Icon(
              draft.step == BookingStep.branch
                  ? Icons.close_rounded
                  : Icons.arrow_back_rounded,
            ),
            onPressed: () {
              if (!controller.back()) _close();
            },
          ),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: StepProgress(
                  index: draft.step.index,
                  total: BookingStep.values.length,
                  title: draft.step.title,
                ),
              ),
              Expanded(child: _StepBody(draft: draft)),
              _BookingBar(draft: draft),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepBody extends ConsumerWidget {
  const _StepBody({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) => switch (draft.step) {
    BookingStep.branch => _BranchStep(draft: draft),
    BookingStep.service => _ServiceStep(draft: draft),
    BookingStep.date => _DateStep(draft: draft),
    BookingStep.slot => _SlotStep(draft: draft),
    BookingStep.confirm => _ConfirmStep(draft: draft),
  };
}

// ─── Step 1: branch ──────────────────────────────────────────────────────────

class _BranchStep extends ConsumerWidget {
  const _BranchStep({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ClinicBranch>> async = ref.watch(
      clinicBranchesProvider,
    );
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );

    return async.when(
      loading: () => const AppLoading(label: 'Finding branches'),
      error: (Object error, StackTrace _) => AppErrorView(
        error: error,
        onRetry: () => ref.invalidate(clinicBranchesProvider),
      ),
      data: (List<ClinicBranch> branches) {
        if (branches.isEmpty) {
          return const AppEmptyState(
            title: 'No branches listed',
            message:
                'We could not load our branches just now. '
                'Please try again shortly.',
            icon: Icons.storefront_outlined,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          itemCount: branches.length,
          separatorBuilder: (BuildContext _, int _) =>
              const SizedBox(height: AppSpacing.sm),
          itemBuilder: (BuildContext context, int index) {
            final ClinicBranch branch = branches[index];
            final bool selected = draft.branch?.id == branch.id;
            return _SelectableTile(
              selected: selected,
              icon: Icons.storefront_outlined,
              title: branch.name,
              subtitle: <String?>[
                branch.address,
                branch.hoursSummary,
              ].whereType<String>().join('\n'),
              onTap: () => controller.selectBranch(branch),
            );
          },
        );
      },
    );
  }
}

// ─── Step 2: service ─────────────────────────────────────────────────────────

class _ServiceStep extends ConsumerWidget {
  const _ServiceStep({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        for (final AppointmentType type in AppointmentType.bookable)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _SelectableTile(
              selected: draft.type == type,
              icon: switch (type) {
                AppointmentType.eyeTest => Icons.visibility_outlined,
                AppointmentType.frameFitting => Icons.face_retouching_natural,
                AppointmentType.consultation => Icons.forum_outlined,
                AppointmentType.other => Icons.event_outlined,
              },
              title: type.label,
              subtitle: type.blurb,
              onTap: () => controller.selectType(type),
            ),
          ),
      ],
    );
  }
}

// ─── Step 3: date ────────────────────────────────────────────────────────────

class _DateStep extends ConsumerWidget {
  const _DateStep({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        Text(
          'All times are Nairobi time.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        DateStrip(selected: draft.date, onSelected: controller.selectDate),
      ],
    );
  }
}

// ─── Step 4: slot ────────────────────────────────────────────────────────────

class _SlotStep extends ConsumerWidget {
  const _SlotStep({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ClinicBranch? branch = draft.branch;
    final String? date = draft.date;
    if (branch == null || date == null) return const SizedBox.shrink();

    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );
    final ThemeData theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        if (draft.error != null) ...<Widget>[
          InlineNotice(message: draft.error!, icon: Icons.event_busy_outlined),
          const SizedBox(height: AppSpacing.md),
        ],
        Text(
          formatLongDate(instantOf(date, '00:00') ?? DateTime.now().toUtc()),
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          branch.name,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        SlotGrid(
          branchId: branch.id,
          date: date,
          selected: draft.time,
          onSelected: controller.selectTime,
        ),
        const SizedBox(height: AppSpacing.md),
        const LiveAvailabilityNote(),
      ],
    );
  }
}

// ─── Step 5: confirm ─────────────────────────────────────────────────────────

class _ConfirmStep extends ConsumerStatefulWidget {
  const _ConfirmStep({required this.draft});

  final BookingDraft draft;

  @override
  ConsumerState<_ConfirmStep> createState() => _ConfirmStepState();
}

class _ConfirmStepState extends ConsumerState<_ConfirmStep> {
  late final TextEditingController _name = TextEditingController(
    text: widget.draft.contactName,
  );
  late final TextEditingController _phone = TextEditingController(
    text: widget.draft.contactPhone,
  );
  late final TextEditingController _notes = TextEditingController(
    text: widget.draft.notes,
  );

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final BookingDraft draft = widget.draft;
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );
    final DateTime? instant = draft.instant;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        if (draft.error != null) ...<Widget>[
          InlineNotice(
            message: draft.error!,
            icon: Icons.error_outline_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        ClinicalCard(
          title: 'Your visit',
          child: Column(
            children: <Widget>[
              DetailRow(
                label: 'Branch',
                value: draft.branch?.name ?? '—',
                icon: Icons.place_outlined,
              ),
              DetailRow(
                label: 'Service',
                value: draft.type.label,
                icon: Icons.medical_services_outlined,
              ),
              DetailRow(
                label: 'When',
                value: instant == null
                    ? '—'
                    : '${formatLongDate(instant)}\n'
                          '${formatSlotLabel(draft.time!)} (Nairobi time)',
                icon: Icons.schedule_rounded,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Who is coming in?',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'The branch calls this number to confirm.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          onChanged: controller.setContactName,
          decoration: const InputDecoration(labelText: 'Full name'),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          onChanged: controller.setContactPhone,
          decoration: const InputDecoration(
            labelText: 'Phone',
            hintText: '+254700123456',
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: _notes,
          maxLines: 3,
          maxLength: 800,
          onChanged: controller.setNotes,
          decoration: const InputDecoration(
            labelText: 'Anything we should know? (optional)',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        const InlineNotice(
          tone: StatusTone.muted,
          icon: Icons.sms_outlined,
          message:
              'We will text you to confirm. Bring your current glasses '
              'and any prescription you have.',
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

class _SelectableTile extends StatelessWidget {
  const _SelectableTile({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: selected ? theme.colorScheme.primary : theme.dividerColor,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: ListTile(
        onTap: onTap,
        selected: selected,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        leading: Icon(icon, color: theme.colorScheme.primary),
        title: Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: subtitle.isEmpty ? null : Text(subtitle),
        trailing: Icon(
          selected ? Icons.check_circle_rounded : Icons.chevron_right_rounded,
          color: selected ? theme.colorScheme.primary : null,
        ),
      ),
    );
  }
}

class _BookingBar extends ConsumerWidget {
  const _BookingBar({required this.draft});

  final BookingDraft draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final BookingController controller = ref.read(
      bookingControllerProvider.notifier,
    );
    final bool last = draft.step == BookingStep.confirm;

    return Material(
      elevation: 8,
      color: theme.scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: FilledButton(
          onPressed: !draft.canAdvance
              ? null
              : last
              ? () async {
                  final ScaffoldMessengerState messenger = ScaffoldMessenger.of(
                    context,
                  );
                  final bool ok = await controller.submit();
                  if (!ok && context.mounted) {
                    // The controller has already put the reason on screen
                    // and walked the wizard back where it needs to be; the
                    // snack bar is only for the case where the step body is
                    // scrolled past the notice.
                    final String? error = ref
                        .read(bookingControllerProvider)
                        .error;
                    if (error != null) {
                      messenger.showSnackBar(SnackBar(content: Text(error)));
                    }
                  }
                }
              : controller.next,
          child: Text(switch (draft.step) {
            BookingStep.branch => 'Continue',
            BookingStep.service => 'Continue',
            BookingStep.date => 'Continue',
            BookingStep.slot =>
              draft.time == null
                  ? 'Pick a time'
                  : 'Continue with ${formatSlotLabel(draft.time!)}',
            BookingStep.confirm =>
              draft.submitting ? 'Booking…' : 'Confirm booking',
          }),
        ),
      ),
    );
  }
}

class _BookedScreen extends StatelessWidget {
  const _BookedScreen({
    required this.appointment,
    required this.branch,
    required this.onDone,
    required this.onBookAnother,
  });

  final Appointment appointment;
  final ClinicBranch? branch;
  final VoidCallback onDone;
  final VoidCallback onBookAnother;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Booked'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: <Widget>[
            const SizedBox(height: AppSpacing.lg),
            Icon(
              Icons.event_available_rounded,
              size: 64,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Your visit is booked',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'We will confirm by SMS. You can move or cancel it any time '
              'before the day.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            ClinicalCard(
              child: Column(
                children: <Widget>[
                  DetailRow(
                    label: 'Branch',
                    value: branch?.name ?? '—',
                    icon: Icons.place_outlined,
                  ),
                  DetailRow(
                    label: 'Service',
                    value: appointment.type.label,
                    icon: Icons.medical_services_outlined,
                  ),
                  DetailRow(
                    label: 'When',
                    value:
                        '${formatLongDate(appointment.scheduledAt)}\n'
                        '${formatSlotLabel(appointment.timeKey)} (Nairobi time)',
                    icon: Icons.schedule_rounded,
                  ),
                ],
              ),
            ),

            // TODO(core): an "Add to calendar" button belongs here. It needs a
            // calendar plugin (`add_2_calendar` or `device_calendar`), and this
            // slice may not add a dependency — so the button is omitted rather
            // than shipped inert. `appointment.scheduledAt` is the exact UTC
            // instant it would need.
            const SizedBox(height: AppSpacing.lg),
            FilledButton(onPressed: onDone, child: const Text('Done')),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: onBookAnother,
              child: const Text('Book another visit'),
            ),
          ],
        ),
      ),
    );
  }
}
