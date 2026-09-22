/// Cancellation models — SPEC-06 R1/R2, `apps/api/.../cancellation.service.ts`.
///
/// Note the mixed casing in the wire format, which is not a mistake in this
/// file: `GET /orders/:id/cancellation` returns the request row straight out of
/// Postgres (`decline_reason`, `created_at`, `decided_at`), while
/// `POST /orders/:id/cancellation` hand-builds a camelCase body (`createdAt`).
/// Both spellings are accepted below so neither response surprises the UI.
library;

/// A customer's cancellation request and its decision, if any.
class CancellationRequest {
  const CancellationRequest({
    required this.id,
    required this.status,
    this.reason,
    this.declineReason,
    this.createdAt,
    this.decidedAt,
  });

  final String id;

  /// `pending` | `approved` | `declined`.
  final String status;
  final String? reason;
  final String? declineReason;
  final DateTime? createdAt;
  final DateTime? decidedAt;

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isDeclined => status == 'declined';

  factory CancellationRequest.fromJson(Map<String, dynamic> json) =>
      CancellationRequest(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? 'pending',
        reason: _str(json['reason']),
        declineReason: _str(json['decline_reason'] ?? json['declineReason']),
        createdAt: _date(json['created_at'] ?? json['createdAt']),
        decidedAt: _date(json['decided_at'] ?? json['decidedAt']),
      );
}

/// Eligibility plus the latest request — the whole of `GET /orders/:id/cancellation`.
///
/// Eligibility is never computed on the device. SPEC-06 R2: "the storefront
/// displays the answer; it never decides". [canRequest] and [ineligibleReason]
/// are rendered as given.
class CancellationStatus {
  const CancellationStatus({
    required this.orderId,
    required this.canRequest,
    required this.windowHours,
    this.ineligibleReason,
    this.request,
  });

  final String orderId;
  final bool canRequest;
  final int windowHours;
  final String? ineligibleReason;
  final CancellationRequest? request;

  /// Nothing worth drawing: no control to offer, no request to report and no
  /// explanation to give. The panel renders nothing at all in that case.
  bool get isSilent =>
      !canRequest && request == null && ineligibleReason == null;

  factory CancellationStatus.fromJson(Map<String, dynamic> json) =>
      CancellationStatus(
        orderId: json['orderId'] as String? ?? '',
        canRequest: json['canRequest'] as bool? ?? false,
        windowHours: (json['windowHours'] as num?)?.toInt() ?? 0,
        ineligibleReason: _str(json['ineligibleReason']),
        request: json['request'] is Map<String, dynamic>
            ? CancellationRequest.fromJson(
                json['request'] as Map<String, dynamic>,
              )
            : null,
      );
}

/// The `POST /orders/:id/cancellation` reply.
///
/// [message] is the API's own wording — "received … we will confirm shortly",
/// never "cancelled". SPEC-06 R1 is explicit that the customer must not be told
/// their order is cancelled before a human has decided, so this is shown
/// verbatim rather than being rewritten on the device.
class CancellationOutcome {
  const CancellationOutcome({
    required this.id,
    required this.status,
    required this.message,
    this.createdAt,
  });

  final String id;
  final String status;
  final String message;
  final DateTime? createdAt;

  factory CancellationOutcome.fromJson(
    Map<String, dynamic> json,
  ) => CancellationOutcome(
    id: json['id'] as String? ?? '',
    status: json['status'] as String? ?? 'pending',
    message:
        _str(json['message']) ??
        'Your cancellation request has been received. We will confirm shortly.',
    createdAt: _date(json['createdAt'] ?? json['created_at']),
  );
}

String? _str(Object? raw) =>
    raw is String && raw.trim().isNotEmpty ? raw.trim() : null;

DateTime? _date(Object? raw) =>
    raw is String ? DateTime.tryParse(raw)?.toLocal() : null;
