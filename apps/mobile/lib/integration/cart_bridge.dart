import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/providers.dart';
import '../core/router/app_router.dart';
import '../core/router/routes.dart';
import '../features/catalog/state/add_to_cart.dart';
import '../features/commerce/state/cart_providers.dart';

/// Joins the catalog's add-to-cart button to the commerce slice's cart.
///
/// This lives in `lib/integration/` rather than `lib/core/` on purpose: it is
/// the one place that knowingly imports two feature slices, and core must stay
/// importable by any of them without a cycle.
///
/// The catalog owns the button and nothing else; commerce owns cart state. The
/// contracts differ in two ways this bridge reconciles — commerce reports
/// failure as a returned `CartActionResult`, while the catalog expects a thrown
/// `ApiException` it can surface verbatim.

/// An add that was attempted while signed out, replayed after sign-in.
///
/// SPEC-11 P0-3 requires that add-to-cart while signed out "routes to sign-in,
/// then completes the original add". Without this the customer signs in and
/// lands on an empty cart, having to find the frame again — the exact friction
/// the account wall was already costing us.
class PendingAddToCart extends Notifier<AddToCartIntent?> {
  @override
  AddToCartIntent? build() => null;

  void park(AddToCartIntent? intent) => state = intent;
}

final NotifierProvider<PendingAddToCart, AddToCartIntent?>
pendingAddToCartProvider = NotifierProvider<PendingAddToCart, AddToCartIntent?>(
  PendingAddToCart.new,
);

/// The handler the catalog's `addToCartHandlerProvider` is overridden with.
AddToCartHandler buildAddToCartHandler(Ref ref) {
  return (AddToCartIntent intent) async {
    final AuthState auth = ref.read(authControllerProvider);

    if (!auth.isAuthenticated) {
      // Park the intent and send them to sign-in. `from` returns them to the
      // product they were looking at, and the replay below finishes the job.
      ref.read(pendingAddToCartProvider.notifier).park(intent);
      final String from = Uri.encodeComponent(Routes.productOf(intent.slug));
      ref.read(routerProvider).go('${Routes.login}?from=$from');
      return;
    }

    await _add(ref.read(cartControllerProvider.notifier), intent);
  };
}

/// Takes the controller rather than a `Ref`, so the same code serves both the
/// handler (which holds a `Ref`) and the replay listener (a `WidgetRef`).
Future<void> _add(CartController cart, AddToCartIntent intent) async {
  final CartActionResult result = await cart.addItem(
    productId: intent.productId,
    quantity: intent.quantity,
  );

  if (!result.succeeded) {
    // The catalog shows `message` verbatim; it is server-written and already
    // customer-safe (quantity bounds from 0034, stock, and so on).
    throw ApiException(
      message: result.message ?? 'Could not add that to your cart.',
    );
  }
}

/// Replays a parked add once the customer signs in.
///
/// Mounted once, above the router. Failures are swallowed deliberately: the
/// customer has just signed in and is looking at a product page, and an error
/// toast about an add they made a minute ago would be noise. The cart badge
/// simply will not move, which is legible on its own.
class CartBridge extends ConsumerStatefulWidget {
  const CartBridge({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<CartBridge> createState() => _CartBridgeState();
}

class _CartBridgeState extends ConsumerState<CartBridge> {
  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authControllerProvider, (
      AuthState? was,
      AuthState now,
    ) {
      if (was?.isAuthenticated == true || !now.isAuthenticated) return;

      final AddToCartIntent? pending = ref.read(pendingAddToCartProvider);
      if (pending == null) return;

      ref.read(pendingAddToCartProvider.notifier).park(null);
      _add(
        ref.read(cartControllerProvider.notifier),
        pending,
      ).catchError((Object _) {});
    });

    return widget.child;
  }
}
