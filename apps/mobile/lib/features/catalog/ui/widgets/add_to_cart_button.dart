import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../catalog_strings.dart';
import '../../domain/product.dart';
import '../../state/add_to_cart.dart';

/// Builds the intent for a product. Kept in one place so the card button and
/// the detail button cannot describe the same tap differently.
AddToCartIntent intentFor(Product product, {int quantity = 1}) =>
    AddToCartIntent(
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceKes: product.priceKes,
      quantity: quantity,
      imageUrl: product.primaryImageUrl,
    );

/// Runs the commerce slice's handler, if one has been registered.
///
/// TODO(commerce): when `addToCartHandlerProvider` is overridden this becomes
/// a real mutation. Until then it reports plainly that the cart is not wired
/// up, which is the whole of this slice's cart responsibility.
Future<void> performAddToCart(
  BuildContext context,
  WidgetRef ref,
  AddToCartIntent intent,
) async {
  final AddToCartHandler? handler = ref.read(addToCartHandlerProvider);
  final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);

  if (handler == null) {
    messenger.showSnackBar(
      const SnackBar(content: Text(CatalogStrings.cartNotWired)),
    );
    return;
  }

  try {
    await handler(intent);
  } on ApiException catch (e) {
    // `message` is server-written and customer-safe (see `ApiException`).
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }
}

/// Full-width add-to-cart, for the product detail screen.
///
/// Disabled — not hidden — when the product is out of stock, so the reason is
/// legible next to it rather than the control silently vanishing.
class AddToCartButton extends ConsumerStatefulWidget {
  const AddToCartButton({super.key, required this.product, this.quantity = 1});

  final Product product;
  final int quantity;

  @override
  ConsumerState<AddToCartButton> createState() => _AddToCartButtonState();
}

class _AddToCartButtonState extends ConsumerState<AddToCartButton> {
  bool _busy = false;

  Future<void> _onPressed() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await performAddToCart(
        context,
        ref,
        intentFor(widget.product, quantity: widget.quantity),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool enabled = widget.product.isPurchasable && !_busy;

    return FilledButton.icon(
      onPressed: enabled ? _onPressed : null,
      icon: _busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.shopping_bag_outlined),
      label: Text(
        widget.product.isPurchasable
            ? CatalogStrings.addToCart
            : CatalogStrings.outOfStock,
      ),
    );
  }
}

/// Compact add-to-cart for a grid tile.
class AddToCartIconButton extends ConsumerStatefulWidget {
  const AddToCartIconButton({super.key, required this.product});

  final Product product;

  @override
  ConsumerState<AddToCartIconButton> createState() =>
      _AddToCartIconButtonState();
}

class _AddToCartIconButtonState extends ConsumerState<AddToCartIconButton> {
  bool _busy = false;

  Future<void> _onPressed() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await performAddToCart(context, ref, intentFor(widget.product));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool enabled = widget.product.isPurchasable && !_busy;

    return IconButton(
      onPressed: enabled ? _onPressed : null,
      visualDensity: VisualDensity.compact,
      tooltip: widget.product.isPurchasable
          ? CatalogStrings.addToCart
          : CatalogStrings.outOfStock,
      icon: _busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.add_shopping_cart_outlined),
    );
  }
}
