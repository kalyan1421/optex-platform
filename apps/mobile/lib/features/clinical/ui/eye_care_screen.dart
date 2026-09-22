import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../data/contact_profile_repository.dart';
import '../domain/appointment.dart';
import '../domain/eye_record.dart';
import '../domain/nairobi_time.dart';
import '../state/appointments_providers.dart';
import '../state/clinical_providers.dart';
import '../state/eye_care_providers.dart';
import 'widgets/clinical_chrome.dart';
import 'widgets/eye_care_steps.dart';
import 'widgets/measurement_table.dart';

/// The eye-care intake form and the record of what has already been sent.
///
/// Long forms get abandoned. This one is split into four short steps with a
/// visible progress bar, and every keystroke lives in a controller above the
/// widget tree — so stepping back, being interrupted, or bouncing off the
/// login wall costs nothing. Nothing is submitted until the last step.
class EyeCareScreen extends ConsumerStatefulWidget {
  const EyeCareScreen({super.key});

  @override
  ConsumerState<EyeCareScreen> createState() => _EyeCareScreenState();
}

class _EyeCareScreenState extends ConsumerState<EyeCareScreen> {
  bool _formOpen = false;

  @override
  void initState() {
    super.initState();
    // `fireImmediately` matters here: the booking wizard may have resolved this
    // provider already, and a change-only listener would never deliver a
    // cached profile — leaving the customer to retype their own details.
    ref.listenManual<AsyncValue<ContactProfile>>(contactProfileProvider, (
      AsyncValue<ContactProfile>? _,
      AsyncValue<ContactProfile> next,
    ) {
      final ContactProfile? profile = next.value;
      if (profile == null) return;
      ref
          .read(intakeControllerProvider.notifier)
          .prefill(
            name: profile.fullName,
            phone: profile.phone,
            email: profile.email,
          );
    }, fireImmediately: true);
  }

  @override
  Widget build(BuildContext context) {
    final IntakeState state = ref.watch(intakeControllerProvider);
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );

    if (state.submitted != null) {
      return _SubmittedScreen(
        record: state.submitted!,
        onDone: () {
          controller.reset();
          setState(() => _formOpen = false);
        },
      );
    }

    if (_formOpen) {
      return _IntakeForm(
        state: state,
        onExit: () => setState(() => _formOpen = false),
      );
    }

    return _EyeCareHome(
      hasDraft: !state.draft.isBlank,
      onStart: () => setState(() => _formOpen = true),
    );
  }
}

// ─── Landing: what this is, plus past submissions ────────────────────────────

class _EyeCareHome extends ConsumerWidget {
  const _EyeCareHome({required this.hasDraft, required this.onStart});

  final bool hasDraft;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<List<EyeRecord>> async = ref.watch(eyeRecordsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Eye care')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(eyeRecordsProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: <Widget>[
            Text(
              'Tell us about your eyes',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Fill this in before you visit and your optometrist reads your '
              'file before you sit down. One record, every branch.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: onStart,
              icon: Icon(
                hasDraft ? Icons.edit_note_rounded : Icons.assignment_outlined,
              ),
              label: Text(
                hasDraft ? 'Continue your form' : 'Start your record',
              ),
            ),
            if (hasDraft) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'You have an unfinished form. It is kept on this phone only, '
                'and only until you close the app.',
                textAlign: TextAlign.center,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Text(
              'Your records',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            async.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
                child: AppLoading(),
              ),
              error: (Object error, StackTrace _) => AppErrorView(
                error: error,
                onRetry: () => ref.invalidate(eyeRecordsProvider),
              ),
              data: (List<EyeRecord> records) => records.isEmpty
                  ? const AppEmptyState(
                      title: 'Nothing on file yet',
                      message:
                          'Once you send your first record it will live '
                          'here, and at every Optex branch.',
                      icon: Icons.folder_open_outlined,
                    )
                  : Column(
                      children: <Widget>[
                        for (final EyeRecord record in records)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: _RecordCard(record: record),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.record});

  final EyeRecord record;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ClinicalCard(
      title: record.fullName,
      trailing: StatusPill(
        label: record.status.label,
        tone: record.status == EyeRecordStatus.reviewed
            ? StatusTone.positive
            : StatusTone.progress,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Sent ${formatShortDate(record.createdAt)}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          if (record.conditions.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: <Widget>[
                for (final String condition in record.conditions)
                  Chip(
                    label: Text(condition),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
              ],
            ),
          ],
          if (record.hasPrescription) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            MeasurementTable(
              columns: const <String>['SPH', 'CYL', 'AXIS', 'ADD', 'PD'],
              rightEye: <String>[
                formatSigned(record.rightEye.sphere),
                formatSigned(record.rightEye.cylinder),
                formatPlain(record.rightEye.axis),
                formatSigned(record.rightEye.add),
                formatPlain(record.rightEye.pd, decimals: 1),
              ],
              leftEye: <String>[
                formatSigned(record.leftEye.sphere),
                formatSigned(record.leftEye.cylinder),
                formatPlain(record.leftEye.axis),
                formatSigned(record.leftEye.add),
                formatPlain(record.leftEye.pd, decimals: 1),
              ],
            ),
          ],
          if (record.branchId == null) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            const InlineNotice(
              tone: StatusTone.muted,
              icon: Icons.place_outlined,
              message:
                  'Not linked to a visit, so no branch holds this record '
                  'yet. Link one next time and the branch team sees it before '
                  'you arrive.',
            ),
          ],
        ],
      ),
    );
  }
}

// ─── The form ────────────────────────────────────────────────────────────────

class _IntakeForm extends ConsumerWidget {
  const _IntakeForm({required this.state, required this.onExit});

  final IntakeState state;
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );
    final bool last = state.step == IntakeStep.review;

    return PopScope(
      canPop: state.step == IntakeStep.about,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (didPop) return;
        controller.back();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Your eye record'),
          leading: IconButton(
            icon: Icon(
              state.step == IntakeStep.about
                  ? Icons.close_rounded
                  : Icons.arrow_back_rounded,
            ),
            onPressed: () {
              if (!controller.back()) onExit();
            },
          ),
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: StepProgress(
                  index: state.step.index,
                  total: IntakeStep.values.length,
                  title: state.step.title,
                  blurb: state.step.blurb,
                ),
              ),
              Expanded(
                child: switch (state.step) {
                  IntakeStep.about => AboutStep(state: state),
                  IntakeStep.history => HistoryStep(state: state),
                  IntakeStep.prescription => PrescriptionStep(state: state),
                  IntakeStep.review => _ReviewStep(state: state),
                },
              ),
              Material(
                elevation: 8,
                color: theme.scaffoldBackgroundColor,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: FilledButton(
                    onPressed: state.submitting
                        ? null
                        : () async {
                            if (!last) {
                              controller.next();
                              return;
                            }
                            final ScaffoldMessengerState messenger =
                                ScaffoldMessenger.of(context);
                            final bool ok = await controller.submit();
                            if (!ok) {
                              final String? error = ref
                                  .read(intakeControllerProvider)
                                  .submitError;
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text(
                                    error ??
                                        'Please check the highlighted answers.',
                                  ),
                                ),
                              );
                            }
                          },
                    child: Text(
                      state.submitting
                          ? 'Sending…'
                          : last
                          ? 'Send to the clinic'
                          : 'Continue',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Step 4: review ──────────────────────────────────────────────────────────

class _ReviewStep extends ConsumerWidget {
  const _ReviewStep({required this.state});

  final IntakeState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );
    final EyeRecordDraft draft = state.draft;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        if (state.submitError != null) ...<Widget>[
          InlineNotice(
            message: state.submitError!,
            icon: Icons.error_outline_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        ClinicalCard(
          title: 'About you',
          trailing: TextButton(
            onPressed: () => controller.goTo(IntakeStep.about),
            child: const Text('Edit'),
          ),
          child: Column(
            children: <Widget>[
              DetailRow(label: 'Name', value: draft.fullName.trim()),
              if (draft.age.trim().isNotEmpty)
                DetailRow(label: 'Age', value: draft.age.trim()),
              DetailRow(label: 'Phone', value: draft.phone.trim()),
              if (draft.email.trim().isNotEmpty)
                DetailRow(label: 'Email', value: draft.email.trim()),
              if (draft.gender != null)
                DetailRow(label: 'Gender', value: draft.gender!),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ClinicalCard(
          title: 'Eye health',
          trailing: TextButton(
            onPressed: () => controller.goTo(IntakeStep.history),
            child: const Text('Edit'),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (draft.conditions.isEmpty)
                Text(
                  'Nothing selected.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                )
              else
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: <Widget>[
                    for (final String condition in draft.conditions)
                      Chip(
                        label: Text(condition),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                  ],
                ),
              if (draft.historyNotes.trim().isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  draft.historyNotes.trim(),
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ClinicalCard(
          title: 'Current lenses',
          trailing: TextButton(
            onPressed: () => controller.goTo(IntakeStep.prescription),
            child: const Text('Edit'),
          ),
          child: draft.hasPrescription
              ? MeasurementTable(
                  columns: const <String>['SPH', 'CYL', 'AXIS', 'ADD', 'PD'],
                  rightEye: <String>[
                    formatSigned(draft.rightEye.sphere),
                    formatSigned(draft.rightEye.cylinder),
                    formatPlain(draft.rightEye.axis),
                    formatSigned(draft.rightEye.add),
                    formatPlain(draft.rightEye.pd, decimals: 1),
                  ],
                  leftEye: <String>[
                    formatSigned(draft.leftEye.sphere),
                    formatSigned(draft.leftEye.cylinder),
                    formatPlain(draft.leftEye.axis),
                    formatSigned(draft.leftEye.add),
                    formatPlain(draft.leftEye.pd, decimals: 1),
                  ],
                )
              : Text(
                  'Left blank — we will test you fresh.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
        ),
        const SizedBox(height: AppSpacing.md),
        const _VisitLinkPicker(),
        const SizedBox(height: AppSpacing.md),
        const InlineNotice(
          tone: StatusTone.muted,
          icon: Icons.lock_outline_rounded,
          message:
              'Once sent, this record cannot be edited from the app — it '
              'becomes part of your clinical file. Your optometrist can '
              'correct anything at your visit.',
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

/// Links the record to one of the caller's own upcoming appointments.
///
/// Why it matters, and why it is on the review step rather than buried:
/// migration 0038 stamps `eye_records.branch_id` from the linked appointment,
/// server-side. Without a link the record carries no branch, and the branch
/// review queue — which is branch-scoped — never shows it. Only an unscoped
/// Super Admin would ever see it. So an unlinked record is valid but much less
/// useful, and the customer should be told that in those terms.
class _VisitLinkPicker extends ConsumerWidget {
  const _VisitLinkPicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );
    final String? linked = ref
        .watch(intakeControllerProvider)
        .draft
        .appointmentId;
    final AsyncValue<List<Appointment>> async = ref.watch(appointmentsProvider);

    return ClinicalCard(
      title: 'Which visit is this for?',
      child: async.when(
        loading: () => const Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: AppLoading(),
        ),
        // A failure to list appointments must not block the submission — the
        // link is optional to the API too.
        error: (Object _, StackTrace _) => Text(
          'We could not load your appointments. You can still send this '
          'record and mention it at your visit.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        data: (List<Appointment> all) {
          final List<Appointment> upcoming = all
              .where((Appointment a) => a.isUpcoming)
              .toList();

          if (upcoming.isEmpty) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'You have no visit booked. Send this record anyway and it '
                  'stays on your file — but booking first means the branch '
                  'team can read it before you arrive.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton.icon(
                  onPressed: () => context.push(Routes.appointmentBooking),
                  icon: const Icon(Icons.event_available_outlined, size: 18),
                  label: const Text('Book an eye test'),
                ),
              ],
            );
          }

          // `RadioGroup` owns the selection for every tile beneath it —
          // `groupValue`/`onChanged` on the tiles themselves are deprecated.
          // The "not for a booked visit" option carries a null value, which is
          // exactly what the API wants when no appointment is linked.
          return RadioGroup<String?>(
            groupValue: linked,
            onChanged: (String? id) => controller.update(
              (EyeRecordDraft d) => id == null
                  ? d.copyWith(clearAppointment: true)
                  : d.copyWith(appointmentId: id),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                for (final Appointment appointment in upcoming)
                  RadioListTile<String?>(
                    value: appointment.id,
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      formatAppointmentStamp(appointment.scheduledAt),
                    ),
                    subtitle: Text(appointment.type.label),
                  ),
                const RadioListTile<String?>(
                  value: null,
                  contentPadding: EdgeInsets.zero,
                  title: Text('Not for a booked visit'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Done ────────────────────────────────────────────────────────────────────

class _SubmittedScreen extends StatelessWidget {
  const _SubmittedScreen({required this.record, required this.onDone});

  final EyeRecord record;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Record sent'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: <Widget>[
            const SizedBox(height: AppSpacing.lg),
            Icon(
              Icons.verified_outlined,
              size: 64,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Your eye record is in',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              record.branchId != null
                  ? 'The branch team will read it before your visit.'
                  : 'It is on your file at every Optex branch.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton(onPressed: onDone, child: const Text('Done')),
          ],
        ),
      ),
    );
  }
}
