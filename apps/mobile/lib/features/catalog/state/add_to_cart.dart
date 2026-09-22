import 'package:flutter_riverpod/flutter_riverpod.dart';

/// What the catalog knows about an add-to-cart tap.
///
/// Deliberately flat and free of catalog types: the commerce slice should not
/// have to import `features/catalog/domain/product.dart` to consume this, and
/// the cart API (`POST /cart/items`) wants a product id and a quantity, not a
/// product row. The extra fields are for optimistic UI and analytics only.
class AddToCartIntent {
  const AddToCartIntent({
    required this.productId,
    required this.slug,
    required this.name,
    required this.priceKes,
    this.quantity = 1,
    this.imageUrl,
  });

  final String productId;
  final String slug;
  final String name;
  final num priceKes;
  final int quantity;
  final String? imageUrl;
}

/// The hook the commerce slice implements.
///
/// Throwing an `ApiException` is the expected failure mode; the catalog
/// surfaces `e.message` in a snackbar and does not interpret it further.
typedef AddToCartHandler = Future<void> Function(AddToCartIntent intent);

/// TODO(commerce): override this provider with the real cart mutation.
///
/// The catalog owns the *button* — where it appears, whether stock allows it,
/// what the intent contains — and nothing else. Cart state, the signed-out
/// redirect (SPEC-11 P0-3: "add-to-cart while signed out routes to sign-in,
/// then completes the original add"), quantity bounds from
/// `0034_cart_qty_bounds.sql` and server totals all belong to the commerce
/// slice and are not implemented here.
///
/// Wiring is one override at integration time:
///
/// ```dart
/// ProviderScope(
///   overrides: <Override>[
///     addToCartHandlerProvider.overrideWith((Ref ref) => ref.read(cartControllerProvider.notifier).add),
///   ],
///   child: const OptexApp(),
/// )
/// ```
///
/// Until that lands the provider yields null, and every add-to-cart affordance
/// says so plainly instead of pretending to work.
final Provider<AddToCartHandler?> addToCartHandlerProvider =
    Provider<AddToCartHandler?>((Ref ref) => null);
