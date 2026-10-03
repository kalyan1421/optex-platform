import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/network/api_exception.dart';
import '../core/providers.dart';
import '../core/router/app_router.dart';
import '../core/router/routes.dart';
import '../core/widgets/app_messenger.dart';
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
      // Park the intent and send them to sign-in; the replay below finishes
      // the job once auth lands.
      ref.read(pendingAddToCartProvider.notifier).park(intent);

      // Where they actually are, which is often a list rather than the
      // product page. Sending everyone to the PDP discarded the scroll and
      // filter state the catalog keeps alive precisely so a return trip lands
      // where it left off.
      final GoRouter router = ref.read(routerProvider);
      final String current = router.routeInformationProvider.value.uri
          .toString();
      final String target = current.isEmpty || current == '/'
          ? Routes.productOf(intent.slug)
          : current;

      router.go('${Routes.login}?from=${Uri.encodeComponent(target)}');
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
/// Mounted once, above the router. A failed replay is reported rather than
/// swallowed — someone who created an account specifically to add a frame
/// deserves to know when it did not go in.
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
      // Reported, not swallowed. Someone who signed up specifically to add a
      // frame that then sold out would otherwise land back on the product
      // page with an empty cart and no explanation.
      _add(ref.read(cartControllerProvider.notifier), pending).catchError((
        Object error,
      ) {
        showAppMessage(
          error is ApiException
              ? error.message
              : 'We could not add that to your cart. Please try again.',
          isError: true,
        );
      });
    });

    return widget.child;
  }
}
