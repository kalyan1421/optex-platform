import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../data/cart_repository.dart';
import '../domain/cart.dart';
import '../domain/line_option.dart';

final Provider<CartRepository> cartRepositoryProvider =
    Provider<CartRepository>(
      (Ref ref) => CartRepository(ref.watch(apiClientProvider)),
    );

/// Outcome of a cart mutation.
///
/// Mutations do not throw at the UI. They return this, because every failure
/// mode here is something the customer is meant to read — "Cart quantity
/// cannot exceed 100 items.", "This promo code has expired." — rather than an
/// exception to be swallowed into a generic red box.
class CartActionResult {
  const CartActionResult.ok() : succeeded = true, message = null;
  const CartActionResult.failed(this.message) : succeeded = false;

  final bool succeeded;

  /// Server-written, customer-safe. Null only on success.
  final String? message;
}

/// The customer's cart.
///
/// The state is always whatever the server last returned. No method computes a
/// quantity, a line total or a cart total locally — each one sends the change
/// and adopts the recomputed cart that comes back (AGENTS.md §6).
class CartController extends AsyncNotifier<Cart> {
  @override
  Future<Cart> build() => ref.read(cartRepositoryProvider).fetch();

  CartRepository get _repo => ref.read(cartRepositoryProvider);

  /// Reloads from the server.
  ///
  /// The current cart stays on screen while the request is in flight —
  /// `AsyncValue.guard` only swaps the state once there is a new one — so the
  /// totals never flash empty and then repopulate.
  Future<void> refresh() async {
    state = await AsyncValue.guard<Cart>(_repo.fetch);
  }

  /// Adds a product to the cart.
  ///
  /// Public because the catalog slice's "Add to cart" goes through it — this
  /// is the one write path into the cart, so the badge, the totals and the
  /// checkout gate can never disagree about what is in it.
  Future<CartActionResult> addItem({
    required String productId,
    int quantity = 1,
    LineOption? option,
  }) => _mutate(
    () =>
        _repo.addItem(productId: productId, quantity: quantity, option: option),
  );

  /// Sets a line's absolute quantity.
  ///
  /// The bounds are the server's (`0034_cart_qty_bounds.sql` caps a line at
  /// 100 and refuses to take one below 1; `UpdateCartItemDto` rejects anything
  /// outside 0..100). Nothing is clamped here on the way out: guessing the
  /// limit client-side is how a UI ends up disagreeing with the database about
  /// what is allowed. We send what the customer asked for and show what the
  /// server says about it.
  Future<CartActionResult> setQuantity(String lineId, int quantity) =>
      _mutate(() => _repo.setQuantity(lineId, quantity), lineId: lineId);

  Future<CartActionResult> removeLine(String lineId) =>
      _mutate(() => _repo.removeLine(lineId), lineId: lineId);

  Future<CartActionResult> applyPromo(String code) =>
      _mutate(() => _repo.applyPromo(code));

  Future<CartActionResult> clearPromo() => _mutate(() => _repo.clearPromo());

  /// Runs one mutation, marking [lineId] busy while it is in flight so that
  /// row can show a spinner without freezing the rest of the cart.
  Future<CartActionResult> _mutate(
    Future<Cart> Function() action, {
    String? lineId,
  }) async {
    final CartBusy busy = ref.read(cartBusyProvider.notifier);
    if (lineId != null) busy.start(lineId);
    try {
      state = AsyncValue<Cart>.data(await action());
      return const CartActionResult.ok();
    } on ApiException catch (e) {
      // The previous cart stays on screen. Every mutation endpoint either
      // applies fully or throws before touching anything, so what is rendered
      // is still what the server holds — the total "reverts" by never having
      // moved.
      return CartActionResult.failed(e.message);
    } finally {
      if (lineId != null) busy.end(lineId);
    }
  }
}

final AsyncNotifierProvider<CartController, Cart> cartControllerProvider =
    AsyncNotifierProvider<CartController, Cart>(CartController.new);

/// Line ids with a mutation in flight.
class CartBusy extends Notifier<Set<String>> {
  @override
  Set<String> build() => const <String>{};

  void start(String lineId) => state = <String>{...state, lineId};

  void end(String lineId) =>
      state = state.where((String id) => id != lineId).toSet();
}

final NotifierProvider<CartBusy, Set<String>> cartBusyProvider =
    NotifierProvider<CartBusy, Set<String>>(CartBusy.new);

/// Total units in the cart, for a tab badge. Zero until the cart has loaded,
/// which is the right answer for a badge — an unknown count renders as none.
final Provider<int> cartItemCountProvider = Provider<int>(
  (Ref ref) => ref.watch(cartControllerProvider).value?.itemCount ?? 0,
);
