/// The tracking timeline, exactly as `GET /orders/:id/tracking` returns it.
///
/// SPEC-11 P0-5 is explicit: "no client-side status inference". So there is no
/// status→stage map anywhere in this app — `completed` and `current` are the
/// server's booleans and are rendered verbatim. If the API lights no stage
/// (which is what `pending_payment` and `cancelled` do), the UI says so rather
/// than guessing a position.
library;

/// One stage of the timeline (`TrackingStageView`).
class TrackingStage {
  const TrackingStage({
    required this.key,
    required this.label,
    required this.completed,
    required this.current,
  });

  /// `received` | `processing` | `dispatched` | `delivered`. Kept as a string
  /// rather than an enum so an added stage renders instead of crashing.
  final String key;
  final String label;
  final bool completed;
  final bool current;

  factory TrackingStage.fromJson(Map<String, dynamic> json) => TrackingStage(
    key: json['key'] as String? ?? '',
    label: json['label'] as String? ?? '',
    completed: json['completed'] as bool? ?? false,
    current: json['current'] as bool? ?? false,
  );
}

/// Tracking response for one order (`OrderTrackingView`).
class OrderTracking {
  const OrderTracking({
    required this.orderId,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.cancelled,
    required this.stages,
  });

  final String orderId;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final bool cancelled;
  final List<TrackingStage> stages;

  /// True when the server has lit nothing at all — an order awaiting payment,
  /// or a cancelled one. The screen explains the blank timeline from [status]
  /// instead of inventing a stage for it.
  bool get noStageReached => stages.every((TrackingStage s) => !s.completed);

  factory OrderTracking.fromJson(Map<String, dynamic> json) => OrderTracking(
    orderId: json['orderId'] as String? ?? '',
    orderNumber: json['orderNumber'] as String? ?? '',
    status: json['status'] as String? ?? 'unknown',
    paymentStatus: json['paymentStatus'] as String? ?? 'unknown',
    cancelled: json['cancelled'] as bool? ?? false,
    stages: (json['stages'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(TrackingStage.fromJson)
        .toList(),
  );
}
