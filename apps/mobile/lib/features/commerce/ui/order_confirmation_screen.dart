import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/money.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/checkout_draft.dart';
import '../domain/order.dart';
import '../state/checkout_providers.dart';
import 'widgets/line_option_chips.dart';
import 'widgets/money_summary.dart';
import 'widgets/product_thumbnail.dart';

/// The end of checkout.
///
/// Two deliberate properties:
///
///   * **The payment screen is not behind it.** Arriving here is a `go`, which
///     rebuilds the stack, and the system back gesture is intercepted and sent
///     home rather than allowed to walk backwards into a finished payment
///     (SPEC-11 P0-4).
///   * **It reads the order from the server**, not from checkout state, so it
///     renders the same whether the customer just paid, followed a push
///     notification, or opened a deep link days later.
class OrderConfirmationScreen extends ConsumerWidget {
  const OrderConfirmationScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<Order> orderAsync = ref.watch(
      confirmationOrderProvider(orderId),
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        context.go(Routes.home);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Order placed'),
          automaticallyImplyLeading: false,
          actions: <Widget>[
            IconButton(
              tooltip: 'Home',
              onPressed: () => context.go(Routes.home),
              icon: const Icon(Icons.home_outlined),
            ),
          ],
        ),
        body: orderAsync.when(
          loading: () => const AppLoading(label: 'Fetching your order…'),
          error: (Object error, StackTrace stack) => AppErrorView(
            error: error,
            onRetry: () => ref.invalidate(confirmationOrderProvider(orderId)),
          ),
          data: (Order order) => _Confirmation(order: order),
        ),
        bottomNavigationBar: orderAsync.maybeWhen(
          data: (Order order) => _Actions(order: order),
          orElse: () => null,
        ),
      ),
    );
  }
}

class _Confirmation extends ConsumerWidget {
  const _Confirmation({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: () async =>
          ref.invalidate(confirmationOrderProvider(order.id)),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: <Widget>[
          _Header(order: order),
          const SizedBox(height: AppSpacing.lg),
          _Section(
            title: 'Items',
            child: Column(
              children: <Widget>[
                for (final OrderLine line in order.lines)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        ProductThumbnail(imageUrl: line.imageUrl, size: 56),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                line.displayName,
                                style: theme.textTheme.titleSmall,
                              ),
                              LineOptionChips(option: line.option),
                              Text(
                                '${line.quantity} × ${formatKes(line.unitPriceKes)}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.outline,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          formatKes(line.lineTotalKes),
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _Section(
            title: 'Total',
            child: MoneySummary(rows: order.summaryRows),
          ),
          if (order.shipping != null) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            _Section(
              title: order.isPickup ? 'Collection' : 'Delivery',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(order.shipping!.name, style: theme.textTheme.bodyMedium),
                  Text(
                    order.shipping!.oneLine,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                  Text(
                    order.shipping!.phone,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}

/// Paid, waiting, or cancelled — stated plainly, from the order's own fields.
///
/// `payment_status` is read rather than inferred from what the app last saw a
/// payment do: the webhook and the reconciliation cron both credit orders
/// without the app's involvement, so the order row is the only honest source.
class _Header extends StatelessWidget {
  const _Header({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    final (IconData icon, Color tone, String title, String detail)
    state = switch (order) {
      final Order o when o.isCancelled => (
        Icons.cancel_outlined,
        theme.colorScheme.error,
        'Order cancelled',
        'Order ${o.orderNumber} was cancelled. Talk to us if that looks wrong.',
      ),
      final Order o when o.isPaid => (
        Icons.check_circle_rounded,
        AppColors.success,
        'Payment confirmed',
        "We've received ${formatKes(o.totalKes)} for order ${o.orderNumber}. "
            "We'll let you know as it moves.",
      ),
      final Order o => (
        Icons.schedule_rounded,
        AppColors.warning,
        'Waiting for payment',
        'Order ${o.orderNumber} is placed but not paid yet. If you have just '
            'paid, pull down to refresh — confirmation can take a moment.',
      ),
    };

    return Column(
      children: <Widget>[
        Icon(state.$1, size: 56, color: state.$2),
        const SizedBox(height: AppSpacing.md),
        Text(
          state.$3,
          style: theme.textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          state.$4,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Paid by ${PaymentMethodOption.labelForWire(order.paymentMethod)}',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.order});

  final Order order;

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
              child: OutlinedButton(
                onPressed: () => context.go(Routes.shop),
                child: const Text('Keep shopping'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: () => context.go(Routes.orderTrackingOf(order.id)),
                child: const Text('Track order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
