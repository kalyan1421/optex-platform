import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/money.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/cart.dart';
import '../state/cart_providers.dart';
import '../state/checkout_providers.dart';
import 'widgets/cart_line_tile.dart';
import 'widgets/money_summary.dart';
import 'widgets/promo_field.dart';

/// The cart.
///
/// Everything on screen is the server's: the lines, the quantities it allowed,
/// and every figure in the summary. The only client-side decisions here are
/// which spinner to show and what to do with a message.
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Cart> cartAsync = ref.watch(cartControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your cart'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Refresh',
            onPressed: () =>
                ref.read(cartControllerProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: cartAsync.when(
        loading: () => const AppLoading(label: 'Loading your cart…'),
        error: (Object error, StackTrace stack) => AppErrorView(
          error: error,
          onRetry: () => ref.read(cartControllerProvider.notifier).refresh(),
        ),
        data: (Cart cart) => cart.isEmpty
            ? AppEmptyState(
                title: 'Your cart is empty',
                message: 'Browse the shop and add a frame to get started.',
                icon: Icons.shopping_bag_outlined,
                action: FilledButton(
                  onPressed: () => context.go(Routes.shop),
                  child: const Text('Start shopping'),
                ),
              )
            : _CartBody(cart: cart),
      ),
      bottomNavigationBar: cartAsync.maybeWhen(
        data: (Cart cart) => cart.isEmpty ? null : _CheckoutBar(cart: cart),
        orElse: () => null,
      ),
    );
  }
}

class _CartBody extends ConsumerWidget {
  const _CartBody({required this.cart});

  final Cart cart;

  Future<void> _run(
    BuildContext context,
    Future<CartActionResult> action, {
    String? successMessage,
  }) async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final CartActionResult result = await action;
    if (!context.mounted) return;
    final String? text = result.succeeded ? successMessage : result.message;
    if (text == null) return;
    messenger
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CartController controller = ref.read(cartControllerProvider.notifier);
    final Set<String> busy = ref.watch(cartBusyProvider);
    final String? stockRejection = ref.watch(
      checkoutControllerProvider.select((CheckoutState s) => s.stockRejection),
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      children: <Widget>[
        // Carried over from a checkout that `place_order` rejected on stock.
        // It names the item and the shortfall, so it belongs here, next to the
        // line the customer has to change.
        if (stockRejection != null) ...<Widget>[
          _StockRejectionBanner(
            message: stockRejection,
            onDismiss: () =>
                ref.read(checkoutControllerProvider.notifier).clearMessages(),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        for (final CartLine line in cart.lines) ...<Widget>[
          CartLineTile(
            line: line,
            busy: busy.contains(line.id),
            onQuantityChanged: (int quantity) => _run(
              context,
              controller.setQuantity(line.id, quantity),
              successMessage: quantity <= 0 ? 'Removed from your cart.' : null,
            ),
            onRemove: () => _run(
              context,
              controller.removeLine(line.id),
              successMessage: 'Removed from your cart.',
            ),
          ),
          const Divider(height: 1),
        ],
        const SizedBox(height: AppSpacing.lg),
        PromoField(
          promo: cart.promo,
          onApply: (String code) async {
            final CartActionResult result = await controller.applyPromo(code);
            return result.succeeded ? null : result.message;
          },
          onClear: () => _run(
            context,
            controller.clearPromo(),
            successMessage: 'Promo code removed.',
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        MoneySummary(
          rows: cart.summaryRows,
          footnote:
              'Delivery is added at checkout — it is free when you '
              'collect from a branch.',
        ),
      ],
    );
  }
}

class _StockRejectionBanner extends StatelessWidget {
  const _StockRejectionBanner({required this.message, required this.onDismiss});

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            Icons.inventory_2_outlined,
            color: theme.colorScheme.onErrorContainer,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
            ),
          ),
          IconButton(
            onPressed: onDismiss,
            icon: const Icon(Icons.close_rounded, size: 18),
            tooltip: 'Dismiss',
            color: theme.colorScheme.onErrorContainer,
          ),
        ],
      ),
    );
  }
}

class _CheckoutBar extends StatelessWidget {
  const _CheckoutBar({required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: theme.dividerColor)),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    '${cart.itemCount} ${cart.itemCount == 1 ? 'item' : 'items'}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                  Text(
                    // The server's total for the cart. Delivery is not in it —
                    // `place_order` adds that — which is what the footnote
                    // above the summary says.
                    formatKes(cart.totalKes),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: () => context.push(Routes.checkout),
                child: const Text('Checkout'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
