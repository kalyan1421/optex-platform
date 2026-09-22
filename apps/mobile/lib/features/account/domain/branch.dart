import 'package:intl/intl.dart';

/// Opening hours for one weekday: `[open, close]` as 24h `HH:MM`, or null when
/// the branch is closed that day (`BranchHoursDto`).
class DayHours {
  const DayHours({required this.open, required this.close});

  final String open;
  final String close;

  /// `"09:00"` -> minutes since midnight, or null when unparseable. Bad data
  /// is treated as "we don't know", never as midnight.
  static int? _minutes(String hhmm) {
    final List<String> parts = hhmm.split(':');
    if (parts.length != 2) return null;
    final int? h = int.tryParse(parts[0]);
    final int? m = int.tryParse(parts[1]);
    if (h == null || m == null || h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  int? get openMinutes => _minutes(open);
  int? get closeMinutes => _minutes(close);

  /// `"9:00 AM – 6:00 PM"`. Falls back to the raw strings if either side does
  /// not parse, which is still more useful than hiding the row.
  String get display {
    final String? o = _format(open);
    final String? c = _format(close);
    if (o == null || c == null) return '$open – $close';
    return '$o – $c';
  }

  static String? _format(String hhmm) {
    final int? mins = _minutes(hhmm);
    if (mins == null) return null;
    final DateTime t = DateTime(2000, 1, 1, mins ~/ 60, mins % 60);
    return DateFormat.jm().format(t);
  }

  static DayHours? fromJson(dynamic value) {
    if (value is! List || value.length < 2) return null;
    final String open = value[0].toString();
    final String close = value[1].toString();
    if (open.isEmpty || close.isEmpty) return null;
    return DayHours(open: open, close: close);
  }
}

/// A week of opening hours, keyed by `DateTime.weekday` (1 = Monday).
class BranchHours {
  const BranchHours(this._byWeekday);

  final Map<int, DayHours> _byWeekday;

  static const List<String> _keys = <String>[
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
  ];

  static const List<String> _labels = <String>[
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  bool get isEmpty => _byWeekday.isEmpty;

  DayHours? forWeekday(int weekday) => _byWeekday[weekday];

  static String labelFor(int weekday) => _labels[weekday - 1];

  /// All seven days in order, so a closed day renders as "Closed" rather than
  /// disappearing from the list.
  List<(int weekday, DayHours? hours)> get week => <(int, DayHours?)>[
        for (int d = 1; d <= 7; d++) (d, _byWeekday[d]),
      ];

  /// Whether the branch is open at [now]. Null when the day has no hours data
  /// at all — "unknown" and "closed" are different answers and only one of
  /// them should be shown as a red chip.
  bool? isOpenAt(DateTime now) {
    if (isEmpty) return null;
    final DayHours? today = _byWeekday[now.weekday];
    if (today == null) return false;
    final int? open = today.openMinutes;
    final int? close = today.closeMinutes;
    if (open == null || close == null) return null;
    final int mins = now.hour * 60 + now.minute;
    // A close time at or before the open time means the branch trades past
    // midnight; treat the window as wrapping rather than as always-closed.
    if (close <= open) return mins >= open || mins < close;
    return mins >= open && mins < close;
  }

  factory BranchHours.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const BranchHours(<int, DayHours>{});
    final Map<int, DayHours> out = <int, DayHours>{};
    for (int i = 0; i < _keys.length; i++) {
      final DayHours? day = DayHours.fromJson(json[_keys[i]]);
      if (day != null) out[i + 1] = day;
    }
    return BranchHours(out);
  }
}

/// Mirrors `BranchRow` (`apps/api/src/modules/branches/branches.service.ts`).
class Branch {
  const Branch({
    required this.id,
    required this.slug,
    required this.name,
    required this.hours,
    required this.isActive,
    this.address,
    this.phone,
    this.lat,
    this.lng,
  });

  final String id;
  final String slug;
  final String name;
  final String? address;
  final String? phone;
  final double? lat;
  final double? lng;
  final BranchHours hours;
  final bool isActive;

  bool get hasCoordinates => lat != null && lng != null;

  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
        id: json['id'] as String,
        slug: json['slug'] as String? ?? '',
        name: json['name'] as String? ?? 'Branch',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
        hours: BranchHours.fromJson(json['hours'] as Map<String, dynamic>?),
        isActive: json['is_active'] as bool? ?? true,
      );
}

/// A branch paired with how far away it is, in metres. [distanceMetres] is
/// null whenever we have no fix or the branch has no coordinates.
class BranchDistance {
  const BranchDistance({required this.branch, this.distanceMetres});

  final Branch branch;
  final double? distanceMetres;

  /// `"1.4 km"` / `"320 m"`. Null when unknown, so the caller can omit the
  /// line entirely rather than print a placeholder.
  String? get distanceLabel {
    final double? d = distanceMetres;
    if (d == null) return null;
    if (d < 1000) return '${d.round()} m away';
    return '${(d / 1000).toStringAsFixed(d < 10000 ? 1 : 0)} km away';
  }
}
