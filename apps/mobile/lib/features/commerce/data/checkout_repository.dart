import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/checkout_draft.dart';
import '../domain/order.dart';

/// `POST /checkout` plus the order read-back it needs.
///
/// The request body carries no money at all — not a subtotal, not a total, not
/// a line price. `place_order` recomputes everything from live product prices
/// inside one transaction, and `CheckoutDto`'s whitelist strips anything else
/// the client tried to send.
class CheckoutRepository {
  CheckoutRepository(this._api);

  final ApiClient _api;

  /// Places the order from the caller's server-side cart.
  ///
  /// Throws [ApiException]. Two failure shapes matter to the UI:
  ///
  ///   * **409** — the stock guard in `0020_checkout_stock_enforcement.sql`
  ///     rejected the basket. The message already names the offending line
  ///     ("Only 2 of \"Aviator Classic\" left — you asked for 3."), so it is
  ///     shown verbatim; rewriting it would throw away the only part the
  ///     customer can act on.
  ///   * **400** — an empty cart, or a promo that stopped being valid between
  ///     the cart screen and here. Also server-written copy.
  Future<CheckoutResult> placeOrder({
    required PaymentMethodOption method,
    required ShippingAddress address,
    required DeliveryOption delivery,
    String? promoCode,
  }) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/checkout',
      body: <String, dynamic>{
        'paymentMethod': method.wire,
        'deliveryOption': delivery.wire,
        'shippingAddress': address.toJson(),
        if (promoCode != null && promoCode.trim().isNotEmpty)
          'promoCode': promoCode.trim(),
      },
    );
    return CheckoutResult.fromJson(json);
  }

  /// Re-reads an order. Used on every return to the payment screen and on app
  /// resume, because the webhook and the reconciliation cron can mark an order
  /// paid while the app was not looking.
  Future<Order> fetchOrder(String orderId) async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/orders/$orderId',
    );
    return Order.fromJson(json);
  }

  /// Active branches, for the collect-from-a-branch option.
  ///
  /// Public endpoint, but it goes through the authenticated client like
  /// everything else — there is a signed-in customer by the time anyone
  /// reaches checkout.
  Future<List<PickupBranch>> pickupBranches() async {
    final List<dynamic> json = await _api.get<List<dynamic>>('/branches');
    return json
        .whereType<Map<String, dynamic>>()
        .map(PickupBranch.fromJson)
        .toList();
  }

  /// The customer's saved addresses, for prefilling the form.
  ///
  /// Best-effort by design: an address book that fails to load must not block
  /// a checkout that only needs the form filled in by hand.
  Future<List<SavedAddress>> savedAddresses() async {
    try {
      final List<dynamic> json = await _api.get<List<dynamic>>('/addresses');
      return json
          .whereType<Map<String, dynamic>>()
          .map(SavedAddress.fromJson)
          .toList();
    } on ApiException {
      return const <SavedAddress>[];
    }
  }
}
