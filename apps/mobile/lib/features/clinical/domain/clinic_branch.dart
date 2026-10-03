import 'clinical_json.dart';

/// A branch, as far as booking a visit needs to know about one.
///
/// Mirrors the subset of `BranchDto` the clinical flows use. Named
/// `ClinicBranch` rather than `Branch` on purpose: the store-locator slice owns
/// the richer model (distance, map pins, geolocation), and two feature slices
/// each declaring a `Branch` would collide the first time someone imports both.
class ClinicBranch {
  const ClinicBranch({
    required this.id,
    required this.name,
    this.slug,
    this.address,
    this.phone,
    this.hours,
    this.isActive = true,
  });

  final String id;
  final String name;
  final String? slug;
  final String? address;
  final String? phone;

  /// Raw `branches.hours` jsonb: `{ mon: ["09:00","18:00"], sun: null }`.
  /// Displayed as a summary; the bookable grid always comes from
  /// `GET /appointments/slots`, which is the only thing that also knows about
  /// breaks, capacity and existing bookings.
  final Map<String, dynamic>? hours;

  final bool isActive;

  /// A one-line opening-hours summary, or null when the branch lists none.
  ///
  /// Collapses Mon–Fri when every weekday matches, which is the common case
  /// and the same simplification the storefront's `BranchHoursSummary` makes.
  /// Falls back to naming today rather than inventing a pattern that is not
  /// there.
  String? get hoursSummary {
    final Map<String, dynamic>? raw = hours;
    if (raw == null || raw.isEmpty) return null;

    const List<String> weekdays = <String>['mon', 'tue', 'wed', 'thu', 'fri'];
    final List<String>? monday = _window(raw['mon']);
    final bool uniform =
        monday != null &&
        weekdays.every((String day) {
          final List<String>? window = _window(raw[day]);
          return window != null &&
              window[0] == monday[0] &&
              window[1] == monday[1];
        });

    final List<String>? saturday = _window(raw['sat']);
    if (uniform) {
      final String weekdayPart = 'Mon–Fri ${monday[0]}–${monday[1]}';
      return saturday == null
          ? '$weekdayPart · Sat closed'
          : '$weekdayPart · Sat ${saturday[0]}–${saturday[1]}';
    }

    final List<String> open = <String>[
      for (final String day in <String>[
        'mon',
        'tue',
        'wed',
        'thu',
        'fri',
        'sat',
        'sun',
      ])
        if (_window(raw[day]) != null) day,
    ];
    if (open.isEmpty) return null;
    return 'Open ${open.length} ${open.length == 1 ? 'day' : 'days'} a week';
  }

  static List<String>? _window(dynamic value) {
    if (value is! List || value.length < 2) return null;
    final String? open = asText(value[0]);
    final String? close = asText(value[1]);
    if (open == null || close == null) return null;
    return <String>[open, close];
  }

  factory ClinicBranch.fromJson(Map<String, dynamic> json) => ClinicBranch(
    id: json['id'] as String,
    name: asText(json['name']) ?? 'Optex Opticians',
    slug: asText(json['slug']),
    address: asText(json['address']),
    phone: asText(json['phone']),
    hours: json['hours'] is Map<String, dynamic>
        ? json['hours'] as Map<String, dynamic>
        : null,
    isActive: json['is_active'] as bool? ?? true,
  );
}
