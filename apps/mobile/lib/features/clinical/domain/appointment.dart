import 'clinical_json.dart';
import 'nairobi_time.dart';

/// `appt_status` from migration 0001, mirrored by `appointment.dto.ts`.
enum AppointmentStatus {
  pending,
  confirmed,
  rescheduled,
  cancelled,
  completed,
  unknown;

  static AppointmentStatus fromWire(String? value) => switch (value) {
    'pending' => AppointmentStatus.pending,
    'confirmed' => AppointmentStatus.confirmed,
    'rescheduled' => AppointmentStatus.rescheduled,
    'cancelled' => AppointmentStatus.cancelled,
    'completed' => AppointmentStatus.completed,
    _ => AppointmentStatus.unknown,
  };

  String get label => switch (this) {
    AppointmentStatus.pending => 'Awaiting confirmation',
    AppointmentStatus.confirmed => 'Confirmed',
    AppointmentStatus.rescheduled => 'Rescheduled',
    AppointmentStatus.cancelled => 'Cancelled',
    AppointmentStatus.completed => 'Completed',
    AppointmentStatus.unknown => 'Booked',
  };

  /// Statuses the API refuses to cancel or reschedule
  /// (`AppointmentsService.cancelOwn` / `rescheduleOwn` both 409 on these).
  bool get isClosed =>
      this == AppointmentStatus.cancelled ||
      this == AppointmentStatus.completed;
}

/// The three appointment kinds the SOW recognises (`APPOINTMENT_TYPES`).
///
/// `appointments.type` is free text in the schema, so an unrecognised value is
/// carried through rather than dropped — hence [other].
enum AppointmentType {
  eyeTest('eye_test', 'Eye test', 'A full vision examination'),
  frameFitting('frame_fitting', 'Frame fitting', 'Find frames that fit you'),
  consultation('consultation', 'Consultation', 'Talk through your options'),
  other('', 'Appointment', '');

  const AppointmentType(this.wire, this.label, this.blurb);

  final String wire;
  final String label;
  final String blurb;

  static AppointmentType fromWire(String? value) => switch (value) {
    'eye_test' => AppointmentType.eyeTest,
    'frame_fitting' => AppointmentType.frameFitting,
    'consultation' => AppointmentType.consultation,
    _ => AppointmentType.other,
  };

  /// The kinds offered in the booking wizard, in the storefront's order.
  static const List<AppointmentType> bookable = <AppointmentType>[
    AppointmentType.eyeTest,
    AppointmentType.frameFitting,
    AppointmentType.consultation,
  ];
}

/// A row of `appointments`, as returned by every customer-facing route.
///
/// [scheduledAt] is the stored UTC instant. Everything the customer reads is
/// derived from it through `nairobi_time.dart`, never through the device zone.
class Appointment {
  const Appointment({
    required this.id,
    required this.branchId,
    required this.type,
    required this.scheduledAt,
    required this.status,
    required this.createdAt,
    this.customerId,
    this.contactName,
    this.contactPhone,
    this.notes,
  });

  final String id;
  final String branchId;
  final AppointmentType type;
  final DateTime scheduledAt;
  final AppointmentStatus status;
  final DateTime createdAt;
  final String? customerId;
  final String? contactName;
  final String? contactPhone;
  final String? notes;

  /// The Nairobi calendar date this booking sits on — the `date` half of what
  /// the API expects back on a reschedule.
  String get dateKey => dateKeyOf(nairobiWallClock(scheduledAt));

  /// The Nairobi `HH:MM` slot key — the `time` half.
  String get timeKey => timeKeyOf(nairobiWallClock(scheduledAt));

  bool get isPast => scheduledAt.isBefore(DateTime.now().toUtc());

  /// Still on the books and still ahead of us.
  bool get isUpcoming => !status.isClosed && !isPast;

  /// Whether `PATCH /appointments/:id/cancel` would be accepted.
  ///
  /// The service refuses only `cancelled` and `completed`; it does NOT refuse a
  /// booking whose time has passed. That is deliberate on the server's part —
  /// a no-show still needs closing out — so the button stays live here too.
  bool get canCancel => !status.isClosed;

  /// Whether `PATCH /appointments/:id/reschedule` would be accepted.
  ///
  /// Two server rules, both real: a closed booking is a 409, and
  /// `assertSlotBookable` rejects any target slot already in the past. A
  /// booking whose own slot has gone can still technically be moved *forward*,
  /// but the customer has already missed it, and quietly letting them rebook a
  /// missed visit as if nothing happened is worse than telling them to call.
  bool get canReschedule => !status.isClosed && !isPast;

  /// Why a change is not on offer, in the customer's own terms. Null when the
  /// action is available.
  String? get changeBlockedReason {
    if (status == AppointmentStatus.cancelled) {
      return 'This appointment was cancelled. Book a new one when you are ready.';
    }
    if (status == AppointmentStatus.completed) {
      return 'This visit is already complete.';
    }
    if (isPast) {
      return 'This appointment time passed ${formatRelative(scheduledAt)}. '
          'Call the branch and they will rearrange it for you.';
    }
    return null;
  }

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
    id: json['id'] as String,
    branchId: asText(json['branch_id']) ?? '',
    type: AppointmentType.fromWire(asText(json['type'])),
    scheduledAt: asUtcTime(json['scheduled_at']) ?? DateTime.now().toUtc(),
    status: AppointmentStatus.fromWire(asText(json['status'])),
    createdAt: asUtcTime(json['created_at']) ?? DateTime.now().toUtc(),
    customerId: asText(json['customer_id']),
    contactName: asText(json['contact_name']),
    contactPhone: asText(json['contact_phone']),
    notes: asText(json['notes']),
  );
}

/// The response of `GET /appointments/slots` — `SlotsResponseDto`.
class SlotAvailability {
  const SlotAvailability({
    required this.branchId,
    required this.date,
    required this.slots,
  });

  final String branchId;
  final String date;

  /// Free `HH:MM` start times, ascending. Already filtered server-side for
  /// branch hours, breaks, per-slot capacity and times that have passed — the
  /// client must never generate candidates of its own.
  final List<String> slots;

  bool get isEmpty => slots.isEmpty;

  factory SlotAvailability.fromJson(Map<String, dynamic> json) =>
      SlotAvailability(
        branchId: asText(json['branchId']) ?? '',
        date: asText(json['date']) ?? '',
        slots: asTextList(json['slots']),
      );
}
