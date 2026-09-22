import 'package:flutter/material.dart';

import '../../../../core/models/money.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/order.dart';
import 'order_chrome.dart';

/// One row of order history.
///
/// SPEC-11 P0-5 asks for item thumbnails here. `GET /orders` does not return
/// any — its select is `order_items(quantity)`, so the summary carries a count
/// and nothing else (see `orders_routes.dart` for the full note). Rather than
/// firing one detail request per visible row, the tile shows the count on a
/// placeholder tile and the real thumbnails appear on the detail screen.
class OrderCard extends StatelessWidget {
  const OrderCard({
    super.key,
    required this.order,
    required this.onOpen,
    required this.onTrack,
  });

  final OrderSummary order;
  final VoidCallback onOpen;
  final VoidCallback onTrack;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Card(
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  ProductThumb(
                    badge: order.itemCount > 0 ? '${order.itemCount}' : null,
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                order.orderNumber.isEmpty
                                    ? 'Order'
                                    : order.orderNumber,
                                style: theme.textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w700),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              formatKes(order.totalKes),
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          '${formatOrderDate(order.createdAt)} · '
                          '${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'}',
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.outline),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.xs,
                          children: <Widget>[
                            OrderStatusChip(status: order.status, dense: true),
                            PaymentStatusChip(
                              paymentStatus: order.paymentStatus,
                              dense: true,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: <Widget>[
                  if (order.discountKes > 0)
                    Expanded(
                      child: Text(
                        'Discount ${formatKes(order.discountKes)}',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.outline),
                      ),
                    )
                  else
                    const Spacer(),
                  TextButton.icon(
                    onPressed: onTrack,
                    icon: const Icon(Icons.timeline_rounded, size: 18),
                    label: const Text('Track'),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: theme.colorScheme.outline,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
