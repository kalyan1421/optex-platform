import '../../../core/models/paginated.dart';
import '../../../core/network/api_client.dart';
import '../domain/cancellation.dart';
import '../domain/order.dart';
import '../domain/order_tracking.dart';

/// Every orders call, in one place.
///
/// Paths are relative to the configured `/api` base (AGENTS.md), and every
/// request goes through [ApiClient] so auth, refresh, timeouts and
/// `ApiException` mapping are handled once rather than per screen.
///
/// Nothing here interprets the data. Repricing, eligibility and timeline
/// position are all server decisions; this layer only parses them.
class OrdersRepository {
  const OrdersRepository(this._api);

  final ApiClient _api;

  static const String _orders = '/orders';

  /// `GET /orders` — the caller's own history, newest first.
  ///
  /// The API's envelope is `{ data, page, pageSize, total, totalPages }`; the
  /// core [Paginated] parser already accepts `data` alongside `items`.
  Future<Paginated<OrderSummary>> list({int page = 1, int pageSize = 20}) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      _orders,
      query: <String, dynamic>{'page': page, 'pageSize': pageSize},
    );
    return Paginated<OrderSummary>.fromJson(json, OrderSummary.fromJson);
  }

  /// `GET /orders/:id` — 404s rather than 403s when the order is not the
  /// caller's, so a missing order and someone else's look identical.
  Future<OrderDetail> detail(String orderId) async {
    final Map<String, dynamic> json =
        await _api.get<Map<String, dynamic>>('$_orders/$orderId');
    return OrderDetail.fromJson(json);
  }

  /// `GET /orders/:id/tracking` — the server-rendered stage timeline.
  Future<OrderTracking> tracking(String orderId) async {
    final Map<String, dynamic> json =
        await _api.get<Map<String, dynamic>>('$_orders/$orderId/tracking');
    return OrderTracking.fromJson(json);
  }

  /// `GET /orders/:id/cancellation` — eligibility plus the latest request.
  Future<CancellationStatus> cancellationStatus(String orderId) async {
    final Map<String, dynamic> json =
        await _api.get<Map<String, dynamic>>('$_orders/$orderId/cancellation');
    return CancellationStatus.fromJson(json);
  }

  /// `POST /orders/:id/cancellation` — asks; it does not cancel.
  ///
  /// The API rejects an ineligible order with 400 and a second pending request
  /// with 409, both carrying customer-safe copy. Those surface as
  /// `ApiException.message` and are shown as-is.
  Future<CancellationOutcome> requestCancellation(String orderId, {String? reason}) async {
    final String? trimmed = reason?.trim();
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '$_orders/$orderId/cancellation',
      body: <String, dynamic>{
        if (trimmed != null && trimmed.isNotEmpty) 'reason': trimmed,
      },
    );
    return CancellationOutcome.fromJson(json);
  }
}
