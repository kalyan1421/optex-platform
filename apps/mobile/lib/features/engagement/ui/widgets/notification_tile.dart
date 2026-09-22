import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/app_notification.dart';
import '../../domain/notification_category.dart';

/// One row of the notification centre.
///
/// Unread is carried by three cues rather than colour alone — a filled dot, a
/// heavier title and a tinted surface — so it survives a colour-blind reader
/// and a bright Nairobi afternoon.
class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool unread = notification.isUnread;

    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: AppSpacing.minTapTarget),
        color: unread
            ? theme.colorScheme.primary.withValues(alpha: 0.05)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _CategoryAvatar(category: notification.category),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          notification.title,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight:
                                unread ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                      if (unread) ...<Widget>[
                        const SizedBox(width: AppSpacing.sm),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.error,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    notification.body,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    formatTimestamp(notification.createdAt),
                    style: theme.textTheme.labelSmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Relative for anything inside a week, absolute after that — a customer
  /// checking an order wants "2 hours ago", and one scrolling back through
  /// offers wants a date.
  static String formatTimestamp(DateTime at) {
    final Duration elapsed = DateTime.now().difference(at);

    if (elapsed.isNegative) return 'Just now';
    if (elapsed.inMinutes < 1) return 'Just now';
    if (elapsed.inMinutes < 60) return '${elapsed.inMinutes}m ago';
    if (elapsed.inHours < 24) return '${elapsed.inHours}h ago';
    if (elapsed.inDays < 7) return '${elapsed.inDays}d ago';

    return DateFormat('d MMM y').format(at);
  }
}

class _CategoryAvatar extends StatelessWidget {
  const _CategoryAvatar({required this.category});

  final NotificationCategory? category;

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color tint) = switch (category) {
      NotificationCategory.order => (Icons.local_shipping_outlined, AppColors.info),
      NotificationCategory.appointment => (
          Icons.event_available_outlined,
          AppColors.success
        ),
      NotificationCategory.offer => (Icons.local_offer_outlined, AppColors.brandRed),
      // A category this build does not recognise still renders — see
      // NotificationCategory.tryParse.
      null => (Icons.notifications_none_rounded, AppColors.brandBlue),
    };

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 18, color: tint),
    );
  }
}
