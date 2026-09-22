import '../../../core/network/api_client.dart';
import '../domain/eye_record.dart';

/// `/eye-records` — clinical intake from the eye-care form.
///
/// Create and read only, by design: `EyeRecordsController` has no update or
/// delete route because "a submitted clinical intake is immutable from the
/// storefront". So there is no edit affordance anywhere in this slice either.
class EyeRecordsRepository {
  const EyeRecordsRepository(this._api);

  final ApiClient _api;

  static const String _base = '/eye-records';

  /// The caller's own records, newest first.
  Future<List<EyeRecord>> list() async {
    final dynamic data = await _api.get<dynamic>(_base);
    if (data is! List) return const <EyeRecord>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(EyeRecord.fromJson)
        .toList(growable: false);
  }

  /// Submits an intake record.
  ///
  /// When the draft carries an `appointmentId`, the API verifies the
  /// appointment belongs to this customer and copies its `branch_id` onto the
  /// record (migration 0038) — that stamp is what routes the record into a
  /// branch's review queue. An unlinked record is valid but only an unscoped
  /// Super Admin will ever see it, which is why the form pushes for a link.
  Future<EyeRecord> create(EyeRecordDraft draft) async {
    final Map<String, dynamic> data = await _api.post<Map<String, dynamic>>(
      _base,
      body: draft.toJson(),
    );
    return EyeRecord.fromJson(data);
  }
}
