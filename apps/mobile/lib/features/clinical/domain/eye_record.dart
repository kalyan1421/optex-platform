import 'clinical_json.dart';

/// `eye_record_status` from migration 0037.
enum EyeRecordStatus {
  submitted,
  reviewed,
  archived,
  unknown;

  static EyeRecordStatus fromWire(String? value) => switch (value) {
    'submitted' => EyeRecordStatus.submitted,
    'reviewed' => EyeRecordStatus.reviewed,
    'archived' => EyeRecordStatus.archived,
    _ => EyeRecordStatus.unknown,
  };

  String get label => switch (this) {
    EyeRecordStatus.submitted => 'With the clinic',
    EyeRecordStatus.reviewed => 'Reviewed',
    EyeRecordStatus.archived => 'Archived',
    EyeRecordStatus.unknown => 'Submitted',
  };
}

/// One eye's worth of a self-reported spectacle prescription.
///
/// Migration 0037 keeps ADD and PD *per eye*, unlike the `prescriptions` table
/// which has a single `pd` and no ADD at all. That difference is the stated
/// reason the two tables were not merged, so the model keeps them apart too.
class EyeReading {
  const EyeReading({this.sphere, this.cylinder, this.axis, this.add, this.pd});

  /// `numeric(4,2)`, so ±99.99 with two decimals.
  final double? sphere;
  final double? cylinder;

  /// `int check (axis between 0 and 180)`.
  final int? axis;

  /// `numeric(4,2)`.
  final double? add;

  /// `numeric(4,1)` — one decimal, not two.
  final double? pd;

  static const EyeReading empty = EyeReading();

  bool get isEmpty =>
      sphere == null &&
      cylinder == null &&
      axis == null &&
      add == null &&
      pd == null;

  EyeReading copyWith({
    double? sphere,
    double? cylinder,
    int? axis,
    double? add,
    double? pd,
    bool clearSphere = false,
    bool clearCylinder = false,
    bool clearAxis = false,
    bool clearAdd = false,
    bool clearPd = false,
  }) => EyeReading(
    sphere: clearSphere ? null : (sphere ?? this.sphere),
    cylinder: clearCylinder ? null : (cylinder ?? this.cylinder),
    axis: clearAxis ? null : (axis ?? this.axis),
    add: clearAdd ? null : (add ?? this.add),
    pd: clearPd ? null : (pd ?? this.pd),
  );
}

/// A row of `eye_records`, as returned by `GET /eye-records`.
class EyeRecord {
  const EyeRecord({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.status,
    required this.createdAt,
    required this.conditions,
    required this.rightEye,
    required this.leftEye,
    this.appointmentId,
    this.branchId,
    this.age,
    this.email,
    this.gender,
    this.historyNotes,
    this.reviewedAt,
  });

  final String id;
  final String fullName;
  final String phone;
  final EyeRecordStatus status;
  final DateTime createdAt;
  final List<String> conditions;

  /// OD — the right eye, in the notation on a printed prescription card.
  final EyeReading rightEye;

  /// OS — the left eye.
  final EyeReading leftEye;

  final String? appointmentId;
  final String? branchId;
  final int? age;
  final String? email;
  final String? gender;
  final String? historyNotes;
  final DateTime? reviewedAt;

  bool get hasPrescription => !rightEye.isEmpty || !leftEye.isEmpty;

  factory EyeRecord.fromJson(Map<String, dynamic> json) => EyeRecord(
    id: json['id'] as String,
    fullName: asText(json['full_name']) ?? 'Unnamed record',
    phone: asText(json['phone']) ?? '',
    status: EyeRecordStatus.fromWire(asText(json['status'])),
    createdAt: asUtcTime(json['created_at']) ?? DateTime.now().toUtc(),
    conditions: asTextList(json['conditions']),
    rightEye: EyeReading(
      sphere: asDouble(json['sphere_od']),
      cylinder: asDouble(json['cyl_od']),
      axis: asInt(json['axis_od']),
      add: asDouble(json['add_od']),
      pd: asDouble(json['pd_od']),
    ),
    leftEye: EyeReading(
      sphere: asDouble(json['sphere_os']),
      cylinder: asDouble(json['cyl_os']),
      axis: asInt(json['axis_os']),
      add: asDouble(json['add_os']),
      pd: asDouble(json['pd_os']),
    ),
    appointmentId: asText(json['appointment_id']),
    branchId: asText(json['branch_id']),
    age: asInt(json['age']),
    email: asText(json['email']),
    gender: asText(json['gender']),
    historyNotes: asText(json['history_notes']),
    reviewedAt: asUtcTime(json['reviewed_at']),
  );
}

/// The health-history checklist.
///
/// Copied verbatim from `apps/web/components/eye-care/EyeCareForm.jsx` because
/// the column stores the *selected labels* themselves (`conditions text[]`),
/// not ids — so a wording change on one client silently forks the data. If
/// these ever need to drift, the right fix is a lookup table, not two lists.
const List<String> kEyeConditions = <String>[
  'Diabetes',
  'Glaucoma',
  'Cataracts',
  'Previous eye surgery',
  'Family history of eye disease',
  'Currently wear glasses',
  'Currently wear contact lenses',
  'None of the above',
];

/// The mutually-exclusive option: ticking it clears everything else, and
/// ticking anything else clears it. Same rule as the storefront.
const String kNoConditions = 'None of the above';

/// Gender options offered as chips. Free text server-side (`text`, max 40 in
/// the DTO), so the list is a convenience, not a constraint.
const List<String> kGenderOptions = <String>[
  'Female',
  'Male',
  'Other',
  'Prefer not to say',
];

/// Working state for the multi-step intake form.
///
/// Immutable and held by a Notifier rather than by the screen, which is what
/// lets a customer move between steps — or leave the screen entirely and come
/// back — without retyping a long clinical form.
class EyeRecordDraft {
  const EyeRecordDraft({
    this.fullName = '',
    this.age = '',
    this.phone = '',
    this.email = '',
    this.gender,
    this.conditions = const <String>[],
    this.historyNotes = '',
    this.rightEye = EyeReading.empty,
    this.leftEye = EyeReading.empty,
    this.appointmentId,
    this.prefilled = false,
  });

  // Held as raw text, not parsed numbers: a half-typed "-1." must survive a
  // rebuild, and an unparseable entry has to be shown back to the customer to
  // be corrected rather than silently dropped.
  final String fullName;
  final String age;
  final String phone;
  final String email;
  final String? gender;
  final List<String> conditions;
  final String historyNotes;
  final EyeReading rightEye;
  final EyeReading leftEye;

  /// Optional link to one of the caller's own appointments. The API verifies
  /// ownership and stamps `eye_records.branch_id` from it (migration 0038),
  /// which is what puts the record in the right branch's review queue.
  final String? appointmentId;

  /// Whether identity fields have already been seeded from the profile, so a
  /// late-arriving profile response cannot stomp on typing in progress.
  final bool prefilled;

  EyeRecordDraft copyWith({
    String? fullName,
    String? age,
    String? phone,
    String? email,
    String? gender,
    List<String>? conditions,
    String? historyNotes,
    EyeReading? rightEye,
    EyeReading? leftEye,
    String? appointmentId,
    bool? prefilled,
    bool clearGender = false,
    bool clearAppointment = false,
  }) => EyeRecordDraft(
    fullName: fullName ?? this.fullName,
    age: age ?? this.age,
    phone: phone ?? this.phone,
    email: email ?? this.email,
    gender: clearGender ? null : (gender ?? this.gender),
    conditions: conditions ?? this.conditions,
    historyNotes: historyNotes ?? this.historyNotes,
    rightEye: rightEye ?? this.rightEye,
    leftEye: leftEye ?? this.leftEye,
    appointmentId: clearAppointment
        ? null
        : (appointmentId ?? this.appointmentId),
    prefilled: prefilled ?? this.prefilled,
  );

  bool get hasPrescription => !rightEye.isEmpty || !leftEye.isEmpty;

  bool get isBlank =>
      fullName.trim().isEmpty &&
      phone.trim().isEmpty &&
      age.trim().isEmpty &&
      email.trim().isEmpty &&
      historyNotes.trim().isEmpty &&
      conditions.isEmpty &&
      !hasPrescription;

  /// Builds the `POST /eye-records` body.
  ///
  /// Blank cells are omitted rather than sent as 0. The form invites the
  /// customer to leave them empty and be tested fresh, and a stored `0.00`
  /// would be indistinguishable from a genuine plano reading — the same call
  /// `buildEyeRecord` makes in the storefront.
  Map<String, dynamic> toJson() {
    final Map<String, dynamic> body = <String, dynamic>{
      'fullName': fullName.trim(),
      'phone': phone.trim(),
      'conditions': conditions,
    };

    void put(String key, Object? value) {
      if (value != null) body[key] = value;
    }

    put('appointmentId', appointmentId);
    put('age', int.tryParse(age.trim()));
    put('email', email.trim().isEmpty ? null : email.trim());
    put('gender', gender);
    put(
      'historyNotes',
      historyNotes.trim().isEmpty ? null : historyNotes.trim(),
    );

    put('sphereOd', rightEye.sphere);
    put('sphereOs', leftEye.sphere);
    put('cylOd', rightEye.cylinder);
    put('cylOs', leftEye.cylinder);
    put('axisOd', rightEye.axis);
    put('axisOs', leftEye.axis);
    put('addOd', rightEye.add);
    put('addOs', leftEye.add);
    put('pdOd', rightEye.pd);
    put('pdOs', leftEye.pd);

    return body;
  }
}
