import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/order_tracking.dart';

/// The status timeline, drawn from the API's stage list and nothing else.
///
/// It reads `completed` and `current` off each [TrackingStage] and takes the
/// label the server sent. There is no status→stage table in this file, no
/// ordering rule and no "if delivered then…": the server owns the lifecycle
/// (SPEC-06 / SPEC-11 P0-5) and this widget is its renderer. Add a stage
/// server-side and it appears here with no app release.
class TrackingTimeline extends StatelessWidget {
  const TrackingTimeline({super.key, required this.stages, this.dimmed = false});

  final List<TrackingStage> stages;

  /// Greys the whole timeline out — used when the order is cancelled and the
  /// server has deliberately lit nothing.
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    if (stages.isEmpty) {
      return Text(
        'No tracking stages were returned for this order.',
        style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (int i = 0; i < stages.length; i++)
          _TimelineRow(
            stage: stages[i],
            position: i + 1,
            isLast: i == stages.length - 1,
            // The connector below a node belongs to the stage that has been
            // passed, so it only fills once the NEXT stage is reached too.
            connectorFilled: !dimmed &&
                i < stages.length - 1 &&
                stages[i].completed &&
                stages[i + 1].completed,
            dimmed: dimmed,
          ),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.stage,
    required this.position,
    required this.isLast,
    required this.connectorFilled,
    required this.dimmed,
  });

  final TrackingStage stage;
  final int position;
  final bool isLast;
  final bool connectorFilled;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool reached = stage.completed && !dimmed;
    final Color active = theme.colorScheme.primary;
    final Color idle = theme.colorScheme.outline;
    final Color nodeColor = reached ? active : idle;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Column(
            children: <Widget>[
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: reached ? active : Colors.transparent,
                  border: Border.all(color: nodeColor, width: 2),
                ),
                alignment: Alignment.center,
                child: reached
                    ? Icon(Icons.check_rounded, size: 16, color: theme.colorScheme.onPrimary)
                    : Text(
                        '$position',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: idle,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                    color: connectorFilled ? active : theme.dividerColor,
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                top: AppSpacing.xs,
                bottom: isLast ? 0 : AppSpacing.lg,
              ),
              child: Row(
                children: <Widget>[
                  Flexible(
                    child: Text(
                      stage.label.isEmpty ? 'Stage $position' : stage.label,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        fontWeight: reached ? FontWeight.w700 : FontWeight.w500,
                        color: reached ? theme.colorScheme.onSurface : idle,
                      ),
                    ),
                  ),
                  if (stage.current && !dimmed) ...<Widget>[
                    const SizedBox(width: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: active.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Now',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: active,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
