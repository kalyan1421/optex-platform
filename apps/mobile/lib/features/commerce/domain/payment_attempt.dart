import 'checkout_draft.dart';

/// Where a payment attempt has got to.
///
/// SPEC-11 P0-4 requires four *distinct* customer-visible outcomes, and the
/// distinction that matters is between [failed] and [timedOut]:
///
///   * [failed] means the provider told us it failed — the customer cancelled,
///     the PIN was wrong, there was no float. We know no money moved.
///   * [timedOut] means we simply do not know yet. The STK prompt may still be
///     on the handset, the Daraja callback may be late, or our own polling may
///     have lost the race. Telling someone their payment failed when it may
///     have succeeded is the worst thing this screen can do, so an unresolved
///     attempt lands here and never in [failed].
enum PaymentPhase {
  /// Nothing started yet.
  idle,

  /// Calling the provider — STK push or Pesapal submit in flight.
  initiating,

  /// The provider accepted it; waiting on the customer and the callback.
  pending,

  /// Server-confirmed paid. The only state that may say "paid".
  success,

  /// The provider reported a definite failure.
  failed,

  /// Unresolved within our polling window. Recoverable: re-check, retry or
  /// switch rails, all against the SAME order.
  timedOut,
}

/// Resolved status of an M-Pesa STK push (`MpesaStatusView`).
class MpesaStatus {
  const MpesaStatus({
    required this.checkoutRequestId,
    required this.status,
    required this.paid,
    this.resultCode,
    this.resultDesc,
    this.orderId,
  });

  final String checkoutRequestId;

  /// Local transaction status: pending | matched | failed | reversed.
  final String status;

  /// The server's own verdict. The ONLY thing that may turn the UI green.
  final bool paid;

  /// Daraja's result code. Null while the push is still being processed —
  /// which is exactly how "still pending" reaches us.
  final int? resultCode;
  final String? resultDesc;
  final String? orderId;

  /// True when the provider has given a final, negative answer.
  bool get isFailure => status == 'failed' || status == 'reversed';

  factory MpesaStatus.fromJson(Map<String, dynamic> json) => MpesaStatus(
    checkoutRequestId: json['checkoutRequestId'] as String? ?? '',
    status: json['status'] as String? ?? 'pending',
    paid: json['paid'] as bool? ?? false,
    resultCode: (json['resultCode'] as num?)?.toInt(),
    resultDesc: json['resultDesc'] as String?,
    orderId: json['orderId'] as String?,
  );
}

/// Result of initiating an STK push (`MpesaStkPushResult`).
class MpesaPush {
  const MpesaPush({
    required this.checkoutRequestId,
    required this.message,
    this.merchantRequestId,
  });

  final String checkoutRequestId;

  /// Safaricom's own `CustomerMessage` when there is one. Server-written.
  final String message;
  final String? merchantRequestId;

  factory MpesaPush.fromJson(Map<String, dynamic> json) => MpesaPush(
    checkoutRequestId: json['checkoutRequestId'] as String? ?? '',
    message: json['message'] as String? ?? '',
    merchantRequestId: json['merchantRequestId'] as String?,
  );
}

/// Result of initiating a Pesapal payment (`PesapalInitiateResult`).
class PesapalInitiation {
  const PesapalInitiation({
    required this.orderTrackingId,
    required this.redirectUrl,
    required this.message,
  });

  final String orderTrackingId;

  /// Pesapal's hosted payment page. Opened in an in-app webview — and treated
  /// as a place to type a card number, never as evidence of anything.
  final String redirectUrl;
  final String message;

  factory PesapalInitiation.fromJson(Map<String, dynamic> json) =>
      PesapalInitiation(
        orderTrackingId: json['orderTrackingId'] as String? ?? '',
        redirectUrl: json['redirectUrl'] as String? ?? '',
        message: json['message'] as String? ?? '',
      );
}

/// Resolved Pesapal transaction status (`PesapalStatusView`).
class PesapalStatus {
  const PesapalStatus({
    required this.orderTrackingId,
    required this.status,
    required this.paid,
    this.statusCode,
    this.description,
    this.orderId,
  });

  final String orderTrackingId;

  /// Local transaction status: pending | matched | failed | reversed.
  final String status;

  /// The server's verdict, resolved by re-querying Pesapal — not by anything
  /// the webview showed or redirected to.
  final bool paid;
  final int? statusCode;
  final String? description;
  final String? orderId;

  bool get isFailure => status == 'failed' || status == 'reversed';

  factory PesapalStatus.fromJson(Map<String, dynamic> json) => PesapalStatus(
    orderTrackingId: json['orderTrackingId'] as String? ?? '',
    status: json['status'] as String? ?? 'pending',
    paid: json['paid'] as bool? ?? false,
    statusCode: (json['statusCode'] as num?)?.toInt(),
    description: json['paymentStatusDescription'] as String?,
    orderId: json['orderId'] as String?,
  );
}

/// Everything the payment UI needs to render one attempt against one order.
///
/// Deliberately keyed by `orderId`: every retry, and every switch of method,
/// reuses it. There is no path in this slice that produces a second order for
/// the same basket (SPEC-11 P0-4).
class PaymentAttempt {
  const PaymentAttempt({
    required this.phase,
    this.method,
    this.orderId,
    this.checkoutRequestId,
    this.orderTrackingId,
    this.message,
    this.attempt = 0,
    this.busy = false,
    this.pendingSince,
  });

  final PaymentPhase phase;
  final PaymentMethodOption? method;
  final String? orderId;

  /// M-Pesa: the id every status query is keyed by. Kept across a timeout so
  /// "Check again" queries the original push rather than starting a new one.
  final String? checkoutRequestId;

  /// Pesapal: the id `GET /payments/pesapal/status` is keyed by.
  final String? orderTrackingId;

  /// The last server-written message — provider copy, or an `ApiException`
  /// message. Safe to show a customer verbatim.
  final String? message;

  /// How many status queries this attempt has made. Rendered so a waiting
  /// customer can see something is happening.
  final int attempt;

  /// A one-off action (initiate, manual re-check) is in flight.
  final bool busy;

  final DateTime? pendingSince;

  static const PaymentAttempt idle = PaymentAttempt(phase: PaymentPhase.idle);

  bool get isResolved =>
      phase == PaymentPhase.success || phase == PaymentPhase.failed;

  /// True when the customer can act — retry the same rail, switch rails, or
  /// re-check. Both unresolved-but-stopped states qualify.
  bool get isRecoverable =>
      phase == PaymentPhase.failed || phase == PaymentPhase.timedOut;

  PaymentAttempt copyWith({
    PaymentPhase? phase,
    PaymentMethodOption? method,
    String? orderId,
    String? checkoutRequestId,
    String? orderTrackingId,
    String? message,
    int? attempt,
    bool? busy,
    DateTime? pendingSince,
    bool clearMessage = false,
  }) => PaymentAttempt(
    phase: phase ?? this.phase,
    method: method ?? this.method,
    orderId: orderId ?? this.orderId,
    checkoutRequestId: checkoutRequestId ?? this.checkoutRequestId,
    orderTrackingId: orderTrackingId ?? this.orderTrackingId,
    message: clearMessage ? null : (message ?? this.message),
    attempt: attempt ?? this.attempt,
    busy: busy ?? this.busy,
    pendingSince: pendingSince ?? this.pendingSince,
  );
}
