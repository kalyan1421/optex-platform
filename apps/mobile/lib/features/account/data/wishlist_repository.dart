import '../../../core/network/api_client.dart';
import '../domain/wishlist_item.dart';

/// The server-side wishlist. Every route is authenticated and scoped to the
/// caller's own `customers` row.
///
/// Add and remove are both idempotent server-side (composite PK + upsert with
/// `ignoreDuplicates`), which is what lets the UI undo a removal by simply
/// re-adding rather than tracking a pending-delete queue.
class WishlistRepository {
  const WishlistRepository(this._api);

  final ApiClient _api;

  Future<List<WishlistItem>> list() async {
    final List<dynamic> json = await _api.get<List<dynamic>>('/wishlist');
    return json
        .whereType<Map<String, dynamic>>()
        .map(WishlistItem.fromJson)
        .toList(growable: false);
  }

  Future<void> add(String productId) =>
      _api.post<dynamic>('/wishlist/$productId');

  Future<void> remove(String productId) =>
      _api.delete<dynamic>('/wishlist/$productId');
}
