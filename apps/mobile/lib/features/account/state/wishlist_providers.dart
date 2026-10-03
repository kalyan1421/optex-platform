import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/wishlist_repository.dart';
import '../domain/wishlist_item.dart';

final Provider<WishlistRepository> wishlistRepositoryProvider =
    Provider<WishlistRepository>(
      (Ref ref) => WishlistRepository(ref.watch(apiClientProvider)),
    );

/// The signed-in customer's saved products, most recently saved first.
class WishlistController extends AsyncNotifier<List<WishlistItem>> {
  WishlistRepository get _repo => ref.read(wishlistRepositoryProvider);

  @override
  Future<List<WishlistItem>> build() => _repo.list();

  Future<void> refresh() async {
    state = const AsyncValue<List<WishlistItem>>.loading();
    state = await AsyncValue.guard(_repo.list);
  }

  /// Removes optimistically and restores the previous list if the call fails.
  ///
  /// The row is dropped from state before the request so the tap feels
  /// instant; because the endpoint is idempotent, an undo is just an `add`
  /// with no bookkeeping.
  Future<void> remove(String productId) async {
    final List<WishlistItem>? previous = state.value;
    if (previous == null) return;

    state = AsyncValue<List<WishlistItem>>.data(
      previous.where((WishlistItem i) => i.productId != productId).toList(),
    );

    try {
      await _repo.remove(productId);
    } catch (_) {
      state = AsyncValue<List<WishlistItem>>.data(previous);
      rethrow;
    }
  }

  /// Re-saves a product. Used by the undo action, and safe to call for one
  /// that is already saved.
  Future<void> add(String productId) async {
    await _repo.add(productId);
    state = AsyncValue<List<WishlistItem>>.data(await _repo.list());
  }
}

final AsyncNotifierProvider<WishlistController, List<WishlistItem>>
wishlistProvider =
    AsyncNotifierProvider<WishlistController, List<WishlistItem>>(
      WishlistController.new,
    );
