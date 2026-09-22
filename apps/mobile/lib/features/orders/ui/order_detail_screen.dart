import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/money.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../domain/order.dart';
import '../state/orders_providers.dart';
import 'widgets/async_view.dart';
import 'widgets/cancellation_panel.dart';
import 'widgets/order_chrome.dart';

/// One order in full — `Routes.orderDetail` (`/orders/:id`).
///
/// Every amount on this screen is the server's own figure. Nothing is summed,
/// re-VAT-ed or re-discounted here (AGENTS.md rule 6): `place_order` is the
/// single authority on what an order cost, and a client that recalculates it
/// will eventually disagree with the receipt.
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(cancellationStatusProvider(orderId));
    ref.invalidate(orderDetailProvider(orderId));
    try {
      await ref.read(orderDetailProvider(orderId).future);
    } catch (_) {
      // Swallowed on purpose: the failure is already in the provider's
      // AsyncValue and rendered there. Rethrowing here would only leave
      // RefreshIndicator with an unhandled error.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<OrderDetail> async = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: Text(async.value?.orderNumber ?? 'Order'),
        leading: context.canPop()
            ? null
            // Cold deep link: there is nothing to pop back to, so send the
            // customer to their history rather than leaving a dead-end screen.
            : IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => context.go(Routes.orders),
                tooltip: 'My orders',
              ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: AsyncView<OrderDetail>(
            value: async,
            loadingLabel: 'Loading your order…',
            onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
            builder: (BuildContext context, OrderDetail order) =>
                _Body(order: order),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      children: <Widget>[
        _Header(order: order),
        const SizedBox(height: AppSpacing.md),

        SectionCard(
          title: 'Items',
          icon: Icons.inventory_2_outlined,
          child: order.items.isEmpty
              ? Text(
                  'No line items were returned for this order.',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline),
                )
              : Column(
                  children: <Widget>[
                    for (int i = 0; i < order.items.length; i++) ...<Widget>[
                      if (i > 0) const Divider(height: AppSpacing.lg),
                      _ItemRow(item: order.items[i]),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: AppSpacing.md),

        SectionCard(
          title: 'Total',
          icon: Icons.receipt_long_outlined,
          child: Column(
            children: <Widget>[
              DetailRow(label: 'Subtotal', value: formatKes(order.subtotalKes)),
              if (order.discountKes > 0)
                DetailRow(
                  label: order.promoCode == null
                      ? 'Discount'
                      : 'Discount (${order.promoCode})',
                  value: '-${formatKes(order.discountKes)}',
                ),
              DetailRow(label: 'VAT', value: formatKes(order.vatKes)),
              DetailRow(label: 'Delivery', value: formatKes(order.shippingKes)),
              const Divider(height: AppSpacing.lg),
              DetailRow(
                label: 'Total paid',
                value: formatKes(order.totalKes),
                emphasised: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        SectionCard(
          title: 'Payment',
          icon: Icons.payments_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              DetailRow(
                label: 'Method',
                value: paymentMethodLabel(order.paymentMethod),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: PaymentStatusChip(paymentStatus: order.paymentStatus),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        SectionCard(
          title: 'Delivery details',
          icon: Icons.location_on_outlined,
          child: _Delivery(shipping: order.shipping),
        ),

        if (order.notes != null && order.notes!.trim().isNotEmpty) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          SectionCard(
            title: 'Notes',
            icon: Icons.sticky_note_2_outlined,
            child: Text(order.notes!.trim(), style: theme.textTheme.bodyMedium),
          ),
        ],

        const SizedBox(height: AppSpacing.md),
        CancellationPanel(orderId: order.id),

        const SizedBox(height: AppSpacing.lg),
        FilledButton.icon(
          onPressed: () => context.push(Routes.orderTrackingOf(order.id)),
          icon: const Icon(Icons.timeline_rounded),
          label: const Text('Track this order'),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.order});

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        order.orderNumber.isEmpty ? 'Order' : order.orderNumber,
                        style: theme.textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Placed ${formatOrderDateTime(order.createdAt)}',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.outline),
                      ),
                    ],
                  ),
                ),
                Text(
                  formatKes(order.totalKes),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: <Widget>[
                OrderStatusChip(status: order.status),
                PaymentStatusChip(paymentStatus: order.paymentStatus),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item});

  final OrderItem item;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Map<String, dynamic> lens = item.lensOption ?? const <String, dynamic>{};

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        ProductThumb(imageUrl: item.product?.image, size: 64),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                item.displayName,
                style: theme.textTheme.bodyLarge
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              if (item.product?.brand != null) ...<Widget>[
                const SizedBox(height: 2),
                Text(
                  item.product!.brand!,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              ],
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${item.quantity} × ${formatKes(item.unitPriceKes)}',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
              if (lens.isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  lens.entries
                      .map((MapEntry<String, dynamic> e) =>
                          '${humanizeStatus(e.key)}: ${e.value}')
                      .join(' · '),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          formatKes(item.lineTotalKes),
          style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _Delivery extends StatelessWidget {
  const _Delivery({required this.shipping});

  final ShippingDetails? shipping;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ShippingDetails? details = shipping;

    if (details == null) {
      return Text(
        'No delivery or collection details were recorded for this order. '
        'Please call your branch if you need to check.',
        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (details.name != null)
          Text(
            details.name!,
            style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
        for (final String line in details.addressLines) ...<Widget>[
          const SizedBox(height: 2),
          Text(line, style: theme.textTheme.bodyMedium),
        ],
        if (details.phone != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: <Widget>[
              Icon(Icons.phone_outlined, size: 16, color: theme.colorScheme.outline),
              const SizedBox(width: AppSpacing.xs),
              Text(
                details.phone!,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
