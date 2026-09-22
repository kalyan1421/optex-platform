import '../../../core/network/api_client.dart';
import '../domain/appointment.dart';
import '../domain/clinic_branch.dart';

/// `/appointments` and the slice of `/branches` the booking wizard needs.
///
/// `GET /appointments/slots` and `GET /branches` are both `@Public()`, so they
/// are called with `auth: false` — a signed-out customer can browse
/// availability, and only the booking itself needs an account.
class AppointmentsRepository {
  const AppointmentsRepository(this._api);

  final ApiClient _api;

  static const String _base = '/appointments';
  static const String _branches = '/branches';

  /// Active branches, ordered by name.
  Future<List<ClinicBranch>> branches({String? query}) async {
    final dynamic data = await _api.get<dynamic>(
      _branches,
      query: <String, dynamic>{'q': query},
      auth: false,
    );
    if (data is! List) return const <ClinicBranch>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ClinicBranch.fromJson)
        .toList(growable: false);
  }

  /// Free slot start times for a branch on a Nairobi calendar date.
  ///
  /// The list is authoritative and already accounts for opening hours, the
  /// lunch break, the branch's configured per-slot capacity (migration 0018)
  /// and slots that have already started. Never synthesise candidates from a
  /// branch's `hours` — only the server knows what is taken.
  Future<SlotAvailability> slots({
    required String branchId,
    required String date,
  }) async {
    final Map<String, dynamic> data = await _api.get<Map<String, dynamic>>(
      '$_base/slots',
      query: <String, dynamic>{'branchId': branchId, 'date': date},
      auth: false,
    );
    return SlotAvailability.fromJson(data);
  }

  /// The caller's own bookings. The API orders them soonest-first.
  Future<List<Appointment>> list() async {
    final dynamic data = await _api.get<dynamic>(_base);
    if (data is! List) return const <Appointment>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Appointment.fromJson)
        .toList(growable: false);
  }

  /// Books a visit. A 409 means the slot went while the customer was deciding.
  Future<Appointment> create({
    required String branchId,
    required String date,
    required String time,
    required AppointmentType type,
    String? notes,
  }) async {
    final Map<String, dynamic> data = await _api.post<Map<String, dynamic>>(
      _base,
      body: <String, dynamic>{
        'branchId': branchId,
        'date': date,
        'time': time,
        if (type != AppointmentType.other) 'type': type.wire,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> cancel(String id) async {
    final Map<String, dynamic> data = await _api.patch<Map<String, dynamic>>(
      '$_base/$id/cancel',
    );
    return Appointment.fromJson(data);
  }

  Future<Appointment> reschedule({
    required String id,
    required String date,
    required String time,
  }) async {
    final Map<String, dynamic> data = await _api.patch<Map<String, dynamic>>(
      '$_base/$id/reschedule',
      body: <String, dynamic>{'date': date, 'time': time},
    );
    return Appointment.fromJson(data);
  }
}
