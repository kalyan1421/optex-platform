import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Small shared pieces used across the three clinical surfaces.
///
/// They live together because they are the slice's visual vocabulary — a
/// status pill on a prescription and a status pill on an appointment must read
/// as the same thing, or the customer has to learn the screen twice.

/// The tone of a status, independent of which enum produced it.
enum StatusTone { neutral, progress, positive, warning, muted }

extension _ToneColors on StatusTone {
  Color foreground(BuildContext context) => switch (this) {
    StatusTone.neutral => Theme.of(context).colorScheme.primary,
    StatusTone.progress => AppColors.info,
    StatusTone.positive => AppColors.success,
    StatusTone.warning => AppColors.warning,
    StatusTone.muted => Theme.of(context).colorScheme.outline,
  };
}

/// A status pill. Colour is never the only signal — the label always says it
/// too, which is what keeps this readable for a colour-blind customer.
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
  });

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final Color colour = tone.foreground(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        // A tint of the foreground rather than a token of its own, so a new
        // tone cannot arrive without a matching background.
        color: colour.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall
            ?.copyWith(color: colour, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// A titled card. The slice's only container, so spacing cannot drift between
/// the three screens.
class ClinicalCard extends StatelessWidget {
  const ClinicalCard({
    super.key,
    required this.child,
    this.title,
    this.trailing,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.md),
  });

  final Widget child;
  final String? title;
  final Widget? trailing;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Widget body = Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (title != null || trailing != null) ...<Widget>[
            Row(
              children: <Widget>[
                if (title != null)
                  Expanded(
                    child: Text(
                      title!,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                else
                  const Spacer(),
                ?trailing,
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          child,
        ],
      ),
    );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? body : InkWell(onTap: onTap, child: body),
    );
  }
}

/// Step counter plus a progress bar.
///
/// Both, not one: the bar gives an at-a-glance sense of how much is left, and
/// the words give the exact answer a long form needs — "Step 2 of 4" is the
/// difference between a customer finishing and a customer abandoning.
class StepProgress extends StatelessWidget {
  const StepProgress({
    super.key,
    required this.index,
    required this.total,
    required this.title,
    this.blurb,
  });

  final int index;
  final int total;
  final String title;
  final String? blurb;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              'Step ${index + 1} of $total',
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
        ),
        if (blurb != null) ...<Widget>[
          const SizedBox(height: AppSpacing.xs),
          Text(
            blurb!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: (index + 1) / total,
            minHeight: 5,
            backgroundColor: theme.dividerColor,
            semanticsLabel: 'Progress',
            semanticsValue: 'Step ${index + 1} of $total',
          ),
        ),
      ],
    );
  }
}

/// An inline, dismissable-looking notice. Used for the things that are not
/// errors but do need saying — a taken slot, a record that saved without a
/// branch, a permission that has to be granted in Settings.
class InlineNotice extends StatelessWidget {
  const InlineNotice({
    super.key,
    required this.message,
    this.tone = StatusTone.warning,
    this.icon,
    this.action,
  });

  final String message;
  final StatusTone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color colour = tone.foreground(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colour.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(icon ?? Icons.info_outline_rounded, size: 18, color: colour),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(message, style: theme.textTheme.bodySmall)),
            ],
          ),
          if (action != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Align(alignment: Alignment.centerLeft, child: action!),
          ],
        ],
      ),
    );
  }
}

/// A labelled value row, for review and detail panes.
class DetailRow extends StatelessWidget {
  const DetailRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
  });

  final String label;
  final String value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 16, color: theme.colorScheme.outline),
            const SizedBox(width: AppSpacing.sm),
          ],
          SizedBox(
            width: 108,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
