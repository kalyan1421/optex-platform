import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/async_views.dart';
import '../../domain/appointment.dart';
import '../../domain/nairobi_time.dart';
import '../../state/appointments_providers.dart';
import 'clinical_chrome.dart';

/// How far ahead a customer may book.
///
/// A client-side horizon only: nothing in the API caps how far out a booking
/// can go. Sixty days is long enough for an annual check-up reminder to be
/// acted on and short enough that the date strip stays scannable.
const int kBookingHorizonDays = 60;

/// A horizontal strip of bookable days, in Nairobi time.
///
/// Days are generated from today forward rather than from a calendar month,
/// because the question a customer is answering is "how soon can I come in",
/// not "what does June look like". The full calendar is one tap away for the
/// rarer case of booking around a specific date.
class DateStrip extends StatelessWidget {
  const DateStrip({
    super.key,
    required this.selected,
    required this.onSelected,
    this.horizonDays = kBookingHorizonDays,
  });

  final String? selected;
  final ValueChanged<String> onSelected;
  final int horizonDays;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final DateTime today = nairobiWallClock();
    final List<DateTime> days = <DateTime>[
      for (int i = 0; i < horizonDays; i++)
        DateTime.utc(today.year, today.month, today.day).add(Duration(days: i)),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SizedBox(
          height: 82,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: days.length,
            separatorBuilder: (BuildContext _, int _) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (BuildContext context, int index) {
              final DateTime day = days[index];
              final String key = dateKeyOf(day);
              return _DayChip(
                day: day,
                isToday: index == 0,
                selected: key == selected,
                onTap: () => onSelected(key),
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextButton.icon(
          onPressed: () async {
            final DateTime first = DateTime.utc(
              today.year,
              today.month,
              today.day,
            );
            final DateTime? picked = await showDatePicker(
              context: context,
              initialDate: selected == null
                  ? first
                  : (parseDateKey(selected!) ?? first),
              firstDate: first,
              lastDate: first.add(Duration(days: horizonDays)),
              helpText: 'Pick a day',
            );
            if (picked != null) onSelected(dateKeyOf(picked));
          },
          icon: const Icon(Icons.calendar_month_outlined, size: 18),
          label: Text('Pick another day', style: theme.textTheme.labelLarge),
        ),
      ],
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({
    required this.day,
    required this.isToday,
    required this.selected,
    required this.onTap,
  });

  final DateTime day;
  final bool isToday;
  final bool selected;
  final VoidCallback onTap;

  static const List<String> _weekdays = <String>[
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];
  static const List<String> _months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color background = selected
        ? theme.colorScheme.primary
        : theme.colorScheme.surface;
    final Color foreground = selected
        ? theme.colorScheme.onPrimary
        : theme.colorScheme.onSurface;

    return Semantics(
      selected: selected,
      button: true,
      label:
          '${_weekdays[day.weekday - 1]} ${day.day} ${_months[day.month - 1]}'
          '${isToday ? ', today' : ''}',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 64,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? theme.colorScheme.primary : theme.dividerColor,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                isToday ? 'Today' : _weekdays[day.weekday - 1],
                style: theme.textTheme.labelSmall?.copyWith(
                  color: selected
                      ? foreground.withValues(alpha: 0.85)
                      : theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${day.day}',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _months[day.month - 1],
                style: theme.textTheme.labelSmall?.copyWith(
                  color: selected
                      ? foreground.withValues(alpha: 0.85)
                      : theme.colorScheme.outline,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The free-slot grid for one branch on one date.
///
/// Every time shown here came from `GET /appointments/slots`. None are
/// generated locally — the server is the only thing that knows the branch's
/// hours, its lunch break, its configured per-slot capacity and what is
/// already taken. A client that guessed would offer times that 400 on submit.
class SlotGrid extends ConsumerWidget {
  const SlotGrid({
    super.key,
    required this.branchId,
    required this.date,
    required this.selected,
    required this.onSelected,
    this.excludeTime,
  });

  final String branchId;
  final String date;
  final String? selected;
  final ValueChanged<String> onSelected;

  /// A time to show as already-yours rather than unavailable — the booking's
  /// own current slot when rescheduling. The API excludes it from the taken
  /// count anyway (`takenCounts(excludeId:)`), so it will appear free; this
  /// just labels it honestly.
  final String? excludeTime;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final SlotQuery query = (branchId: branchId, date: date);
    final AsyncValue<SlotAvailability> async = ref.watch(slotsProvider(query));

    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
        child: AppLoading(label: 'Checking availability'),
      ),
      error: (Object error, StackTrace _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: AppErrorView(
          error: error,
          onRetry: () => ref.invalidate(slotsProvider(query)),
        ),
      ),
      data: (SlotAvailability availability) {
        if (availability.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
            child: AppEmptyState(
              title: 'Nothing free that day',
              message:
                  'The branch is either closed or fully booked. '
                  'Try the next day along.',
              icon: Icons.event_busy_outlined,
            ),
          );
        }

        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: <Widget>[
            for (final String slot in availability.slots)
              ChoiceChip(
                label: Text(
                  slot == excludeTime
                      ? '${formatSlotLabel(slot)} · now'
                      : formatSlotLabel(slot),
                ),
                selected: slot == selected,
                onSelected: (bool _) => onSelected(slot),
              ),
          ],
        );
      },
    );
  }
}

/// A one-line reminder that availability moves under you.
class LiveAvailabilityNote extends StatelessWidget {
  const LiveAvailabilityNote({super.key});

  @override
  Widget build(BuildContext context) => const InlineNotice(
    tone: StatusTone.muted,
    icon: Icons.update_rounded,
    message:
        'Times are live and can be taken by someone else while you '
        'decide. We check again the moment you confirm.',
  );
}
