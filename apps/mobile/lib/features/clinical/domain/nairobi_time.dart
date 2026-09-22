/// Africa/Nairobi wall-clock helpers.
///
/// Every appointment time in this app is *branch* time, not device time. The
/// API is explicit about it: `appointments.service.ts` pins Nairobi to a fixed
/// `+03:00` ("no DST"), combines the `date` + `time` a client sends into a UTC
/// `scheduled_at`, and reads it back in the same zone to derive the `HH:MM`
/// slot key. This file is the client half of that contract.
///
/// Rendering a slot in the phone's own zone would be actively wrong — a
/// customer travelling, or a device with a bad zone, would be shown a time the
/// branch has never heard of. So all formatting here goes through the fixed
/// offset, and never through `DateTime.toLocal()`.
library;

/// Nairobi's fixed UTC offset. No daylight saving, year-round.
const Duration kNairobiOffset = Duration(hours: 3);

const List<String> _monthNames = <String>[
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const List<String> _weekdayNames = <String>[
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/// Wall-clock time in Nairobi, expressed as a `DateTime` whose UTC fields hold
/// the local values.
///
/// The type is a deliberate lie in one direction only: the returned value is
/// flagged UTC so that `.year`/`.hour` and friends read the Nairobi numbers
/// without the VM re-applying the device zone on top. Never hand one of these
/// to anything that will treat it as a real instant — use [instantOf] for that.
DateTime nairobiWallClock([DateTime? instant]) =>
    (instant ?? DateTime.now()).toUtc().add(kNairobiOffset);

/// The real UTC instant for a Nairobi wall-clock `YYYY-MM-DD` + `HH:MM`.
///
/// Mirrors `AppointmentsService.toUtcIso`. Returns null when either part is
/// malformed, so callers can reject rather than book a garbage time.
DateTime? instantOf(String date, String time) {
  final DateTime? day = parseDateKey(date);
  final (int, int)? clock = parseTimeKey(time);
  if (day == null || clock == null) return null;
  return DateTime.utc(
    day.year,
    day.month,
    day.day,
    clock.$1,
    clock.$2,
  ).subtract(kNairobiOffset);
}

/// `YYYY-MM-DD` for a Nairobi wall-clock date, as the API's `IsCalendarDate`
/// validator expects it.
String dateKeyOf(DateTime wallClock) =>
    '${_pad4(wallClock.year)}-'
    '${_pad2(wallClock.month)}-${_pad2(wallClock.day)}';

/// `HH:MM` (24h) for a Nairobi wall-clock time — the slot-grid key.
String timeKeyOf(DateTime wallClock) =>
    '${_pad2(wallClock.hour)}:${_pad2(wallClock.minute)}';

/// Today's calendar date in Nairobi. The floor for date selection: the API
/// rejects a slot that has already started.
String todayKey() => dateKeyOf(nairobiWallClock());

/// Parses a `YYYY-MM-DD` key into a wall-clock day (time components zeroed).
DateTime? parseDateKey(String date) {
  final RegExpMatch? m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$')
      .firstMatch(date.trim());
  if (m == null) return null;
  final int year = int.parse(m.group(1)!);
  final int month = int.parse(m.group(2)!);
  final int day = int.parse(m.group(3)!);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  final DateTime parsed = DateTime.utc(year, month, day);
  // Rejects 2026-02-31, which `DateTime.utc` would happily roll into March.
  if (parsed.month != month || parsed.day != day) return null;
  return parsed;
}

/// Parses a 24h `HH:MM` key into `(hour, minute)`.
(int, int)? parseTimeKey(String time) {
  final RegExpMatch? m = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$')
      .firstMatch(time.trim());
  if (m == null) return null;
  return (int.parse(m.group(1)!), int.parse(m.group(2)!));
}

/// A slot key as a 12-hour label — `09:30` reads as `9:30 AM`.
///
/// Mirrors `formatSlotLabel` in `apps/web/app/appointments/page.jsx` so the two
/// clients describe the same booking identically.
String formatSlotLabel(String hhmm) {
  final (int, int)? clock = parseTimeKey(hhmm);
  if (clock == null) return hhmm;
  final (int hour, int minute) = clock;
  final String suffix = hour < 12 ? 'AM' : 'PM';
  final int display = hour % 12 == 0 ? 12 : hour % 12;
  return '$display:${_pad2(minute)} $suffix';
}

/// `Friday, 20 June 2026` for a stored UTC instant, in Nairobi time.
String formatLongDate(DateTime instant) {
  final DateTime local = nairobiWallClock(instant);
  return '${_weekdayNames[local.weekday - 1]}, ${local.day} '
      '${_monthNames[local.month - 1]} ${local.year}';
}

/// `20 Jun 2026` — the compact form for list rows.
String formatShortDate(DateTime instant) {
  final DateTime local = nairobiWallClock(instant);
  return '${local.day} ${_monthNames[local.month - 1].substring(0, 3)} ${local.year}';
}

/// `Fri 20 Jun · 9:30 AM` — a whole appointment in one line.
String formatAppointmentStamp(DateTime instant) {
  final DateTime local = nairobiWallClock(instant);
  final String weekday = _weekdayNames[local.weekday - 1].substring(0, 3);
  final String month = _monthNames[local.month - 1].substring(0, 3);
  return '$weekday ${local.day} $month · ${formatSlotLabel(timeKeyOf(local))}';
}

/// A short, human gap — "in 3 days", "in 2 hours", "12 days ago".
///
/// Used to make "you cannot reschedule this" concrete: a customer looking at a
/// greyed-out button deserves to be told the visit was yesterday.
String formatRelative(DateTime instant, {DateTime? from}) {
  final Duration delta = instant.difference(from ?? DateTime.now().toUtc());
  final bool past = delta.isNegative;
  final Duration size = delta.abs();

  final String amount;
  if (size.inMinutes < 1) {
    return past ? 'just now' : 'in under a minute';
  } else if (size.inMinutes < 60) {
    amount = _plural(size.inMinutes, 'minute');
  } else if (size.inHours < 24) {
    amount = _plural(size.inHours, 'hour');
  } else if (size.inDays < 31) {
    amount = _plural(size.inDays, 'day');
  } else {
    amount = _plural(size.inDays ~/ 30, 'month');
  }
  return past ? '$amount ago' : 'in $amount';
}

String _plural(int count, String unit) =>
    '$count $unit${count == 1 ? '' : 's'}';

String _pad2(int value) => value.toString().padLeft(2, '0');
String _pad4(int value) => value.toString().padLeft(4, '0');
