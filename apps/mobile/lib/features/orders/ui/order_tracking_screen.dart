import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../domain/order_tracking.dart';
import '../state/orders_providers.dart';
import 'widgets/async_view.dart';
import 'widgets/cancellation_panel.dart';
import 'widgets/order_chrome.dart';
import 'widgets/tracking_timeline.dart';

/// Order tracking — `Routes.orderTracking` (`/orders/:id/tracking`).
///
/// The timeline is the API's `stages` array, rendered as-is. The screen holds
/// no status→stage mapping of its own, which is the point: SPEC-11 P0-5 asks
/// for "no client-side status inference", and `apps/web`'s tracking page is the
/// cautionary example — it keeps its own five-stage list and its own
/// `getActiveStageIndex`, both of which have already drifted from the four
/// stages the API actually returns.
class OrderTrackingScreen extends ConsumerWidget {
  const OrderTrackingScreen({super.key, required this.orderId});

  final String orderId;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(cancellationStatusProvider(orderId));
    ref.invalidate(orderTrackingProvider(orderId));
    try {
      await ref.read(orderTrackingProvider(orderId).future);
    } catch (_) {
      // Swallowed on purpose: the failure is already in the provider's
      // AsyncValue and rendered there. Rethrowing here would only leave
      // RefreshIndicator with an unhandled error.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<OrderTracking> async = ref.watch(orderTrackingProvider(orderId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Track order'),
        leading: context.canPop()
            ? null
            // Opened cold from `optex://…`: pop would exit the app.
            : IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => context.go(Routes.orders),
                tooltip: 'My orders',
              ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: AsyncView<OrderTracking>(
            value: async,
            loadingLabel: 'Loading tracking…',
            onRetry: () => ref.invalidate(orderTrackingProvider(orderId)),
            builder: (BuildContext context, OrderTracking tracking) =>
                _Body(tracking: tracking),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.tracking});

  final OrderTracking tracking;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      children: <Widget>[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  tracking.orderNumber.isEmpty ? 'Order' : tracking.orderNumber,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: <Widget>[
                    OrderStatusChip(status: tracking.status),
                    PaymentStatusChip(paymentStatus: tracking.paymentStatus),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        if (tracking.cancelled) ...<Widget>[
          _Banner(
            color: AppColors.danger,
            icon: Icons.cancel_outlined,
            title: 'Order cancelled',
            body: 'This order was cancelled, so no delivery stages apply. '
                'Please contact your branch if you have questions.',
          ),
          const SizedBox(height: AppSpacing.md),
        ] else if (tracking.noStageReached) ...<Widget>[
          // The API lights no stage until an order reaches `received`. Saying
          // so beats an unexplained row of empty circles — and the wording
          // still comes from the server's own status value.
          _Banner(
            color: AppColors.warning,
            icon: Icons.schedule_rounded,
            title: 'Not started yet',
            body: 'This order is at "${humanizeStatus(tracking.status)}". '
                'The stages below light up once Optex has it in hand.',
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        SectionCard(
          title: 'Progress',
          icon: Icons.timeline_rounded,
          child: TrackingTimeline(
            stages: tracking.stages,
            dimmed: tracking.cancelled,
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        CancellationPanel(orderId: tracking.orderId),

        const SizedBox(height: AppSpacing.lg),
        OutlinedButton.icon(
          onPressed: () => context.push(Routes.orderDetailOf(tracking.orderId)),
          icon: const Icon(Icons.receipt_long_outlined),
          label: const Text('View order details'),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.color,
    required this.icon,
    required this.title,
    required this.body,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        border: Border.all(color: color.withValues(alpha: 0.32)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 22, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700, color: color),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(body, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
