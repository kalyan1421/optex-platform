/// Shared presentation for the orders slice: status colours, chips, section
/// cards, thumbnails and date formatting.
///
/// Turning `dispatched` into "Dispatched" and a colour is *presentation of* a
/// server value, not inference about it — the app never decides what an order's
/// status is, only how it looks. Unknown values fall through to a neutral chip
/// with the raw value humanised, so a status added server-side renders sensibly
/// on an old build instead of showing nothing.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// `pending_payment` -> `Pending payment`.
String humanizeStatus(String raw) {
  final String cleaned = raw.replaceAll('_', ' ').trim();
  if (cleaned.isEmpty) return 'Unknown';
  return cleaned[0].toUpperCase() + cleaned.substring(1).toLowerCase();
}

/// `payment_method` for display.
///
/// Not run through [humanizeStatus], which would render the client's own
/// payment brands as "Mpesa" and "Cod". `cod` still appears on historical
/// orders even though checkout no longer offers it (CLIENT-ANSWERS E6), so it
/// has to render properly too.
String paymentMethodLabel(String? method) => switch (method) {
  null => 'Not recorded',
  'mpesa' => 'M-Pesa',
  'pesapal' => 'Pesapal (card)',
  'cod' => 'Cash on delivery',
  final String other => humanizeStatus(other),
};

String formatOrderDate(DateTime? when) =>
    when == null ? 'Date unavailable' : DateFormat('d MMM y').format(when);

String formatOrderDateTime(DateTime? when) => when == null
    ? 'Date unavailable'
    : DateFormat('d MMM y, HH:mm').format(when);

/// Colour + icon for an `order_status` value.
({Color color, IconData icon}) orderStatusStyle(
  String status,
  ColorScheme scheme,
) => switch (status) {
  'pending_payment' => (color: AppColors.warning, icon: Icons.schedule_rounded),
  'received' => (color: AppColors.info, icon: Icons.inventory_2_outlined),
  'processing' => (color: AppColors.info, icon: Icons.autorenew_rounded),
  'dispatched' => (color: scheme.primary, icon: Icons.local_shipping_outlined),
  'delivered' => (color: AppColors.success, icon: Icons.task_alt_rounded),
  'cancelled' => (color: AppColors.danger, icon: Icons.cancel_outlined),
  _ => (color: scheme.outline, icon: Icons.help_outline_rounded),
};

/// Colour + icon for a `payment_status` value.
({Color color, IconData icon}) paymentStatusStyle(
  String status,
  ColorScheme scheme,
) => switch (status) {
  'paid' => (color: AppColors.success, icon: Icons.verified_outlined),
  'pending' => (color: AppColors.warning, icon: Icons.schedule_rounded),
  'failed' => (color: AppColors.danger, icon: Icons.error_outline_rounded),
  'refunded' => (color: AppColors.info, icon: Icons.undo_rounded),
  _ => (color: scheme.outline, icon: Icons.help_outline_rounded),
};

/// A small tinted pill. Kept flat and bordered rather than filled so several
/// can sit side by side without shouting over the order number.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.dense = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final TextStyle? style =
        (dense
                ? Theme.of(context).textTheme.labelSmall
                : Theme.of(context).textTheme.labelMedium)
            ?.copyWith(color: color, fontWeight: FontWeight.w600);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? AppSpacing.sm : AppSpacing.sm + AppSpacing.xs,
        vertical: dense ? AppSpacing.xs : AppSpacing.xs + 2,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: dense ? 12 : 14, color: color),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(label, style: style),
        ],
      ),
    );
  }
}

/// Chip for the order's fulfilment status.
class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip({super.key, required this.status, this.dense = false});

  final String status;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final ({Color color, IconData icon}) style = orderStatusStyle(
      status,
      Theme.of(context).colorScheme,
    );
    return StatusChip(
      label: humanizeStatus(status),
      color: style.color,
      icon: style.icon,
      dense: dense,
    );
  }
}

/// Chip for the order's payment status.
class PaymentStatusChip extends StatelessWidget {
  const PaymentStatusChip({
    super.key,
    required this.paymentStatus,
    this.dense = false,
  });

  final String paymentStatus;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final ({Color color, IconData icon}) style = paymentStatusStyle(
      paymentStatus,
      Theme.of(context).colorScheme,
    );
    return StatusChip(
      label: 'Payment: ${humanizeStatus(paymentStatus).toLowerCase()}',
      color: style.color,
      icon: style.icon,
      dense: dense,
    );
  }
}

/// A titled card. Every block on the detail and tracking screens uses one, so
/// they line up without each screen re-inventing padding.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.trailing,
  });

  final String title;
  final Widget child;
  final IconData? icon;
  final Widget? trailing;

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
              children: <Widget>[
                if (icon != null) ...<Widget>[
                  Icon(icon, size: 18, color: theme.colorScheme.outline),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            child,
          ],
        ),
      ),
    );
  }
}

/// A label/value row, used for money breakdowns and payment details.
class DetailRow extends StatelessWidget {
  const DetailRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasised = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool emphasised;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final TextStyle? labelStyle = emphasised
        ? theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)
        : theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.outline,
          );
    final TextStyle? valueStyle = emphasised
        ? theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: valueColor ?? theme.colorScheme.primary,
          )
        : theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: valueColor,
          );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: Text(label, style: labelStyle)),
          const SizedBox(width: AppSpacing.md),
          Text(value, style: valueStyle, textAlign: TextAlign.right),
        ],
      ),
    );
  }
}

/// Product thumbnail with its own loading and failure states.
///
/// `GET /orders` carries no product image (see `orders_routes.dart`), so the
/// history list passes null and gets the fallback glyph; the detail screen has
/// real URLs.
class ProductThumb extends StatelessWidget {
  const ProductThumb({super.key, this.imageUrl, this.size = 56, this.badge});

  final String? imageUrl;
  final double size;

  /// Rendered over the bottom-right corner — the history list uses it for the
  /// item count it has instead of thumbnails.
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final BorderRadius radius = BorderRadius.circular(10);
    final String? url = imageUrl?.trim();

    final Widget fallback = Icon(
      Icons.visibility_outlined,
      size: size * 0.42,
      color: theme.colorScheme.outline,
    );

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: <Widget>[
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: theme.brightness == Brightness.dark
                    ? AppColors.darkSurface
                    : AppColors.lightSurface,
                borderRadius: radius,
                border: Border.all(color: theme.dividerColor),
              ),
              child: ClipRRect(
                borderRadius: radius,
                child: (url == null || url.isEmpty)
                    ? Center(child: fallback)
                    : CachedNetworkImage(
                        imageUrl: url,
                        fit: BoxFit.cover,
                        placeholder: (BuildContext c, String _) => Center(
                          child: SizedBox(
                            width: size * 0.3,
                            height: size * 0.3,
                            child: const CircularProgressIndicator(
                              strokeWidth: 2,
                            ),
                          ),
                        ),
                        errorWidget: (BuildContext c, String _, Object _) =>
                            Center(child: fallback),
                      ),
              ),
            ),
          ),
          if (badge != null)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  badge!,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
