import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../domain/appointment.dart';
import '../domain/nairobi_time.dart';
import '../state/appointments_providers.dart';
import 'widgets/clinical_chrome.dart';
import 'widgets/slot_pickers.dart';

/// Moves an existing booking to a new day and time.
///
/// A bottom sheet rather than a route: rescheduling is a small, reversible
/// edit to a thing the customer is already looking at, and sending them to a
/// full screen loses the context of which appointment they are changing.
Future<void> openRescheduleSheet(
  BuildContext context,
  Appointment appointment,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (BuildContext _) => _RescheduleSheet(appointment: appointment),
  );
}

class _RescheduleSheet extends ConsumerStatefulWidget {
  const _RescheduleSheet({required this.appointment});

  final Appointment appointment;

  @override
  ConsumerState<_RescheduleSheet> createState() => _RescheduleSheetState();
}

class _RescheduleSheetState extends ConsumerState<_RescheduleSheet> {
  late String _date = widget.appointment.dateKey;
  String? _time;
  String? _error;

  /// The branch never changes on a reschedule.
  ///
  /// `RescheduleAppointmentDto` carries only `date` and `time`, and the service
  /// re-validates against `existing.branch_id` — so there is no branch to pick
  /// here, and offering one would be a lie. Moving branch means cancelling and
  /// booking again, which is what the empty state below says.
  String get _branchId => widget.appointment.branchId;

  Future<void> _submit() async {
    final String? time = _time;
    if (time == null) return;

    setState(() => _error = null);
    final NavigatorState navigator = Navigator.of(context);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);

    final String? error = await ref
        .read(appointmentActionsProvider.notifier)
        .reschedule(appointment: widget.appointment, date: _date, time: time);

    if (!mounted) return;
    if (error != null) {
      // Keep the sheet open on failure — the slot grid behind it has just been
      // refreshed, so the customer is one tap from a time that will work.
      setState(() {
        _error = error;
        _time = null;
      });
      return;
    }

    navigator.pop();
    messenger.showSnackBar(const SnackBar(content: Text('Appointment moved.')));
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool busy = ref.watch(appointmentActionsProvider);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      builder: (BuildContext context, ScrollController controller) => Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.all(AppSpacing.md),
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        'Move your appointment',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Currently '
                  '${formatAppointmentStamp(widget.appointment.scheduledAt)}. '
                  'Pick a new day and time at the same branch.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                if (_error != null) ...<Widget>[
                  InlineNotice(
                    message: _error!,
                    icon: Icons.error_outline_rounded,
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],

                DateStrip(
                  selected: _date,
                  onSelected: (String date) => setState(() {
                    _date = date;
                    // A time only means something on the day it was picked
                    // from; carrying it across days would submit a slot the
                    // customer never saw offered.
                    _time = null;
                    _error = null;
                  }),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Times on ${formatLongDate(instantOf(_date, '00:00') ?? widget.appointment.scheduledAt)}',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                SlotGrid(
                  branchId: _branchId,
                  date: _date,
                  selected: _time,
                  excludeTime: _date == widget.appointment.dateKey
                      ? widget.appointment.timeKey
                      : null,
                  onSelected: (String time) => setState(() {
                    _time = time;
                    _error = null;
                  }),
                ),
                const SizedBox(height: AppSpacing.md),
                const LiveAvailabilityNote(),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Need a different branch? Cancel this appointment and book a '
                  'new one — a booking stays with the branch it was made at.',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
          Material(
            elevation: 8,
            color: theme.scaffoldBackgroundColor,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: FilledButton(
                onPressed: (_time == null || busy) ? null : _submit,
                child: Text(
                  busy
                      ? 'Moving…'
                      : _time == null
                      ? 'Pick a time'
                      : 'Move to ${formatSlotLabel(_time!)}',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
