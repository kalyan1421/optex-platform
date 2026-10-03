import 'package:dio/dio.dart' show DioMediaType, FormData, MultipartFile;

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/prescription.dart';
import '../domain/scan_file.dart';

/// `/prescriptions` — the customer half of the prescriptions module.
///
/// Health data. Every route is scoped server-side to the caller's own
/// `customers` row, and a prescription belonging to somebody else comes back as
/// a 404 rather than a 403, so there is nothing to guard client-side beyond
/// not caching what comes back.
class PrescriptionsRepository {
  const PrescriptionsRepository(this._api);

  final ApiClient _api;

  static const String _base = '/prescriptions';

  /// The caller's own prescriptions, newest first. Server-capped at 500.
  Future<List<Prescription>> list() async {
    final dynamic data = await _api.get<dynamic>(_base);
    if (data is! List) return const <Prescription>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Prescription.fromJson)
        .toList(growable: false);
  }

  /// A fresh 60-second signed URL for one prescription.
  ///
  /// Called every single time the customer opens a file — never cached, never
  /// reused. The URL is a bearer capability for a medical record; holding onto
  /// one past the moment it is needed is the whole risk this endpoint exists
  /// to avoid.
  Future<SignedDownload> signedUrl(String id) async {
    final Map<String, dynamic> data = await _api.get<Map<String, dynamic>>(
      '$_base/$id/download',
    );
    return SignedDownload.fromJson(data);
  }

  /// Uploads a scan, reporting byte progress.
  ///
  /// The multipart shape is taken from `apps/api/test/prescriptions.e2e-spec.ts`
  /// rather than inferred: the file part is `.attach('file', …)` and the
  /// measurements are sibling `.field('sphere_od', '-1.25')` text parts, so the
  /// field name here is `file` and every measurement is a stringified form
  /// field alongside it. `@UseInterceptors(FileInterceptor('file', …))` in the
  /// controller is the other half of that.
  ///
  /// [onProgress] is handed straight to `ApiClient.upload`, which wires it to
  /// Dio's `onSendProgress`.
  Future<Prescription> upload({
    required ScanFile scan,
    PrescriptionMeasurements measurements = PrescriptionMeasurements.empty,
    String? orderId,
    void Function(int sent, int total)? onProgress,
  }) async {
    Future<FormData> build() async => FormData.fromMap(<String, dynamic>{
      ...measurements.toFields(),
      'order_id': ?orderId,
      'file': await MultipartFile.fromFile(
        scan.path,
        filename: scan.uploadName,
        // Declared from the sniffed bytes. Dio defaults an unknown file to
        // `application/octet-stream`, which `ALLOWED_MIME` rejects outright
        // — a silent 400 on every upload if this is left off.
        contentType: DioMediaType(scan.mime.type, scan.mime.subtype),
      ),
    });

    try {
      return await _post(await build(), onProgress);
    } on ApiException {
      rethrow;
    } catch (_) {
      // A `FormData` is single-use: Dio finalises its stream on send, and
      // `AuthInterceptor` replays a 401'd request by re-fetching the same
      // `RequestOptions` — which for a multipart body throws a `StateError`
      // about an already-finalised FormData instead of a clean retry. Rebuild
      // and go once more; a second failure is reported honestly.
      try {
        return await _post(await build(), onProgress);
      } on ApiException {
        rethrow;
      } catch (_) {
        throw const ApiException(
          message: 'The upload was interrupted. Please try again.',
          isNetwork: true,
        );
      }
    }
  }

  Future<Prescription> _post(
    FormData form,
    void Function(int sent, int total)? onProgress,
  ) async {
    final Map<String, dynamic> data = await _api.upload<Map<String, dynamic>>(
      '$_base/upload',
      form: form,
      onProgress: onProgress,
    );
    return Prescription.fromJson(data);
  }
}
