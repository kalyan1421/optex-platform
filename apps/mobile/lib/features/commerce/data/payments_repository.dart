import '../../../core/network/api_client.dart';
import '../domain/payment_attempt.dart';

/// The `/payments` endpoints for the two live rails.
///
/// Nothing here decides whether a payment succeeded. Both `query` calls reach
/// the provider server-side and return the server's reconciled verdict; the
/// app's job is to ask, wait, and render the answer.
class PaymentsRepository {
  PaymentsRepository(this._api);

  final ApiClient _api;

  /// Sends the STK prompt to [phone].
  ///
  /// The charged amount is the order's `total_kes`, read server-side — this
  /// call carries no figure. [phone] is permissive at the boundary and
  /// canonicalised in-service, so `0712…`, `254712…` and `+254712…` all work.
  ///
  /// Server-side limits worth knowing, because their messages surface as-is:
  /// initiation is throttled to 5/minute, and an order may only be pushed to
  /// [kMaxStkDestinations] distinct numbers.
  Future<MpesaPush> startStkPush({
    required String orderId,
    required String phone,
  }) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/payments/mpesa/stk-push',
      body: <String, dynamic>{'orderId': orderId, 'phone': phone.trim()},
    );
    return MpesaPush.fromJson(json);
  }

  /// Queries and reconciles one STK push.
  ///
  /// A push Daraja is still processing comes back with `resultCode: null` and
  /// `status: 'pending'` — not an error. That is the signal to keep waiting.
  Future<MpesaStatus> queryMpesa(String checkoutRequestId) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/payments/mpesa/query',
      body: <String, dynamic>{'checkoutRequestId': checkoutRequestId},
    );
    return MpesaStatus.fromJson(json);
  }

  Future<PesapalInitiation> startPesapal(String orderId) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/payments/pesapal/initiate',
      body: <String, dynamic>{'orderId': orderId},
    );
    return PesapalInitiation.fromJson(json);
  }

  /// Confirms a Pesapal payment.
  ///
  /// This is the only thing that may conclude a Pesapal payment succeeded. The
  /// webview's redirect URL proves nothing — anyone can navigate a browser to
  /// a success page — so the app ignores it entirely and asks the server,
  /// which re-queries Pesapal and additionally refuses to credit an order when
  /// the provider-reported amount does not match what was submitted.
  Future<PesapalStatus> queryPesapal(String orderTrackingId) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/payments/pesapal/status',
      query: <String, dynamic>{'orderTrackingId': orderTrackingId},
    );
    return PesapalStatus.fromJson(json);
  }
}

/// Distinct phone numbers one order may STK-push to, mirroring
/// `MAX_STK_DESTINATIONS_PER_ORDER` in the API. Used only to word the warning
/// before the customer hits the limit; the limit itself is enforced server-side.
const int kMaxStkDestinations = 3;
