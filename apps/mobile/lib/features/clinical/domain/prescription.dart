import 'clinical_json.dart';

/// Review state of an uploaded prescription — the `pres_status` enum from
/// migration 0001, as mirrored by `update-prescription-status.dto.ts`.
enum PrescriptionStatus {
  /// Uploaded, waiting for an optician to transcribe it.
  pending,

  /// An optician has read it and entered the measurements.
  processed,

  /// A value this build does not know. Rendered neutrally rather than crashing
  /// — the enum can gain members server-side without a client release.
  unknown;

  static PrescriptionStatus fromWire(String? value) => switch (value) {
    'pending' => PrescriptionStatus.pending,
    'processed' => PrescriptionStatus.processed,
    _ => PrescriptionStatus.unknown,
  };

  String get label => switch (this) {
    PrescriptionStatus.pending => 'In review',
    PrescriptionStatus.processed => 'Reviewed',
    PrescriptionStatus.unknown => 'Unknown',
  };
}

/// A row of the `prescriptions` table, as returned by `GET /prescriptions`
/// and `POST /prescriptions/upload`.
///
/// Mirrors `PRESCRIPTION_COLUMNS` in `apps/api/src/modules/prescriptions/
/// prescriptions.service.ts`. Note what is deliberately NOT here: any kind of
/// usable file URL. `file_url` holds the *bucket-relative object key* inside
/// the private `prescriptions` bucket, and the only way to see the file is to
/// ask `GET /prescriptions/:id/download` for a fresh 60-second signed URL. The
/// field is named [objectPath] here so nobody is tempted to put it in an
/// `Image.network`.
class Prescription {
  const Prescription({
    required this.id,
    required this.status,
    required this.createdAt,
    this.orderId,
    this.objectPath,
    this.sphereOd,
    this.sphereOs,
    this.cylOd,
    this.cylOs,
    this.axisOd,
    this.axisOs,
    this.pd,
    this.processedAt,
  });

  final String id;
  final PrescriptionStatus status;
  final DateTime createdAt;
  final String? orderId;

  /// Storage key, e.g. `<customer-id>/1750000000000-rx.pdf`. Not a URL.
  final String? objectPath;

  final double? sphereOd;
  final double? sphereOs;
  final double? cylOd;
  final double? cylOs;
  final int? axisOd;
  final int? axisOs;
  final double? pd;
  final DateTime? processedAt;

  bool get hasFile => objectPath != null && objectPath!.isNotEmpty;

  /// Whether the stored object is a PDF, inferred from the extension the
  /// service preserved when it sanitised the original filename.
  ///
  /// An inference, not a fact: the row carries no MIME type. It only decides
  /// which viewer to offer, and the image viewer degrades to "open outside the
  /// app" if it cannot decode what it gets.
  bool get isPdf => (objectPath ?? '').toLowerCase().endsWith('.pdf');

  /// True once any measurement is present — either submitted with the upload
  /// or transcribed by an optician during review.
  bool get hasMeasurements =>
      sphereOd != null ||
      sphereOs != null ||
      cylOd != null ||
      cylOs != null ||
      axisOd != null ||
      axisOs != null ||
      pd != null;

  factory Prescription.fromJson(Map<String, dynamic> json) => Prescription(
    id: json['id'] as String,
    status: PrescriptionStatus.fromWire(asText(json['status'])),
    createdAt: asUtcTime(json['created_at']) ?? DateTime.now().toUtc(),
    orderId: asText(json['order_id']),
    objectPath: asText(json['file_url']),
    sphereOd: asDouble(json['sphere_od']),
    sphereOs: asDouble(json['sphere_os']),
    cylOd: asDouble(json['cyl_od']),
    cylOs: asDouble(json['cyl_os']),
    axisOd: asInt(json['axis_od']),
    axisOs: asInt(json['axis_os']),
    pd: asDouble(json['pd']),
    processedAt: asUtcTime(json['processed_at']),
  );
}

/// The response of `GET /prescriptions/:id/download`.
///
/// Intentionally carries [issuedAt] so the UI can tell the customer how long
/// the link has left rather than letting it silently rot. The API's
/// `SIGNED_URL_TTL` is 60 seconds and it says so in [expiresIn]; nothing here
/// hardcodes that number.
class SignedDownload {
  SignedDownload({
    required this.url,
    required this.expiresIn,
    DateTime? issuedAt,
  }) : issuedAt = issuedAt ?? DateTime.now().toUtc();

  final String url;
  final int expiresIn;
  final DateTime issuedAt;

  DateTime get expiresAt => issuedAt.add(Duration(seconds: expiresIn));

  bool get isExpired => DateTime.now().toUtc().isAfter(expiresAt);

  factory SignedDownload.fromJson(Map<String, dynamic> json) => SignedDownload(
    url: json['url'] as String,
    expiresIn: asInt(json['expiresIn']) ?? 60,
  );
}

/// Optional measurements a customer may type alongside the file.
///
/// Mirrors `UploadPrescriptionDto`, including its bounds — validating here
/// turns a 400 round trip into an inline message, and the bounds are the DTO's
/// own, not invented.
class PrescriptionMeasurements {
  const PrescriptionMeasurements({
    this.sphereOd,
    this.sphereOs,
    this.cylOd,
    this.cylOs,
    this.axisOd,
    this.axisOs,
    this.pd,
  });

  final double? sphereOd;
  final double? sphereOs;
  final double? cylOd;
  final double? cylOs;
  final int? axisOd;
  final int? axisOs;
  final double? pd;

  static const PrescriptionMeasurements empty = PrescriptionMeasurements();

  bool get isEmpty =>
      sphereOd == null &&
      sphereOs == null &&
      cylOd == null &&
      cylOs == null &&
      axisOd == null &&
      axisOs == null &&
      pd == null;

  /// Multipart form fields. Absent values are omitted entirely rather than
  /// sent blank: the API's `ValidationPipe` treats a present-but-empty field as
  /// invalid, not absent, which is the same trap `ApiClient._clean` documents
  /// for query strings.
  Map<String, String> toFields() => <String, String>{
    if (sphereOd != null) 'sphere_od': _fmt(sphereOd!),
    if (sphereOs != null) 'sphere_os': _fmt(sphereOs!),
    if (cylOd != null) 'cyl_od': _fmt(cylOd!),
    if (cylOs != null) 'cyl_os': _fmt(cylOs!),
    if (axisOd != null) 'axis_od': '$axisOd',
    if (axisOs != null) 'axis_os': '$axisOs',
    if (pd != null) 'pd': _fmt(pd!),
  };

  static String _fmt(double value) => value.toStringAsFixed(2);
}
