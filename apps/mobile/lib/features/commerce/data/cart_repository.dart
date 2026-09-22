import '../../../core/network/api_client.dart';
import '../domain/cart.dart';
import '../domain/line_option.dart';

/// The `/cart` endpoints.
///
/// Every one of them returns the whole recomputed cart, which is why none of
/// these methods return void: the caller replaces its state with what came
/// back rather than patching a local copy and hoping the totals still agree.
///
/// There is no guest cart — `CartController` sits behind the global auth
/// guard — so every call here assumes a signed-in customer. The router already
/// redirects anonymous visitors to `/login?from=…`.
class CartRepository {
  CartRepository(this._api);

  final ApiClient _api;

  Future<Cart> fetch() async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>(
      '/cart',
    );
    return Cart.fromJson(json);
  }

  /// Adds a product, or increments the matching line.
  ///
  /// "Matching" is product **plus** [option]: the API compares the serialised
  /// `lens_option`, so two configurations of the same frame stay separate
  /// lines. Quantity bounds (1..100) are the server's — a rejection comes back
  /// as an `ApiException` whose message is shown as-is.
  Future<Cart> addItem({
    required String productId,
    int quantity = 1,
    LineOption? option,
  }) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/cart/items',
      body: <String, dynamic>{
        'productId': productId,
        'quantity': quantity,
        if (option != null) 'lensOption': option.toJson(),
      },
    );
    return Cart.fromJson(json);
  }

  /// Sets a line's absolute quantity. Zero removes it, which is the API's own
  /// contract (`UpdateCartItemDto`), not a client-side shortcut.
  Future<Cart> setQuantity(String lineId, int quantity) async {
    final Map<String, dynamic> json = await _api.patch<Map<String, dynamic>>(
      '/cart/items/$lineId',
      body: <String, dynamic>{'quantity': quantity},
    );
    return Cart.fromJson(json);
  }

  Future<Cart> removeLine(String lineId) async {
    final Map<String, dynamic> json = await _api.delete<Map<String, dynamic>>(
      '/cart/items/$lineId',
    );
    return Cart.fromJson(json);
  }

  /// Applies a promo code. An unusable code throws with the server's own
  /// reason ("This promo code has expired.", "…reached its usage limit.") and
  /// leaves the cart untouched, so the total reverts by simply not changing.
  Future<Cart> applyPromo(String code) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/cart/apply-promo',
      body: <String, dynamic>{'code': code.trim()},
    );
    return Cart.fromJson(json);
  }

  Future<Cart> clearPromo() async {
    final Map<String, dynamic> json = await _api.delete<Map<String, dynamic>>(
      '/cart/promo',
    );
    return Cart.fromJson(json);
  }
}
