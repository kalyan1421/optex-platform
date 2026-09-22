import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/cancellation.dart';
import '../../state/orders_providers.dart';
import 'order_chrome.dart';

/// The customer half of SPEC-06 — asking to cancel, and seeing the answer.
///
/// Two rules shape every word here:
///
/// 1. **A request is a request.** Optex decides every cancellation
///    (CLIENT-ANSWERS B5), so the copy never says an order is cancelled until
///    the API says the request was approved. Telling someone their order is
///    cancelled and then declining it is worse than the phone call this
///    replaces.
/// 2. **Eligibility is not computed here.** `canRequest` and
///    `ineligibleReason` come from the server and are rendered as given — a
///    client that decides can be made to decide differently, and the same rules
///    are enforced again on POST anyway.
class CancellationPanel extends ConsumerWidget {
  const CancellationPanel({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<CancellationStatus> async =
        ref.watch(cancellationStatusProvider(orderId));
    final CancellationStatus? status = async.value;

    final Widget content;
    if (status != null) {
      // Nothing to offer and nothing to report — no control, no request, no
      // explanation. The card is dropped entirely rather than left as an empty
      // titled box on the screen.
      if (status.isSilent) return const SizedBox.shrink();
      content = _Loaded(orderId: orderId, status: status);
    } else if (async.error != null) {
      final Object error = async.error!;
      content = _Notice(
        tone: _Tone.neutral,
        icon: Icons.info_outline_rounded,
        title: 'Cancellation options unavailable',
        body: error is ApiException
            ? error.message
            : 'We could not check whether this order can still be cancelled.',
        action: TextButton(
          onPressed: () => ref.invalidate(cancellationStatusProvider(orderId)),
          child: const Text('Try again'),
        ),
      );
    } else {
      content = const Row(
        children: <Widget>[
          SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          SizedBox(width: AppSpacing.sm),
          Text('Checking cancellation options…'),
        ],
      );
    }

    return SectionCard(
      title: 'Cancellation',
      icon: Icons.gavel_rounded,
      child: content,
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.orderId, required this.status});

  final String orderId;
  final CancellationStatus status;

  @override
  Widget build(BuildContext context) {
    final CancellationRequest? request = status.request;
    final List<Widget> blocks = <Widget>[];

    if (request != null && request.isPending) {
      blocks.add(
        _Notice(
          tone: _Tone.warning,
          icon: Icons.hourglass_top_rounded,
          title: 'Cancellation requested',
          body: 'Branch staff are reviewing your request. This order is NOT cancelled '
              'yet — we will confirm by SMS and email once someone has decided.',
          footnote: 'Requested ${formatOrderDateTime(request.createdAt)}'
              '${request.reason == null ? '' : '\nYour reason: ${request.reason}'}',
        ),
      );
    } else if (request != null && request.isApproved) {
      blocks.add(
        _Notice(
          tone: _Tone.danger,
          icon: Icons.cancel_outlined,
          title: 'Cancellation approved',
          body: 'This order has been cancelled.',
          footnote: request.decidedAt == null
              ? null
              : 'Decided ${formatOrderDateTime(request.decidedAt)}',
        ),
      );
    } else if (request != null && request.isDeclined) {
      blocks.add(
        _Notice(
          tone: _Tone.neutral,
          icon: Icons.do_not_disturb_on_outlined,
          title: 'Cancellation declined',
          body: request.declineReason ??
              'Your cancellation request was declined. Please call your branch to discuss it.',
          footnote: request.decidedAt == null
              ? null
              : 'Decided ${formatOrderDateTime(request.decidedAt)}',
        ),
      );
    }

    // A declined request does not close the door: if the order is still within
    // the window the customer may ask again, which is why this is an `if` and
    // not an `else` on the block above.
    if (status.canRequest) {
      if (blocks.isNotEmpty) blocks.add(const SizedBox(height: AppSpacing.sm));
      blocks.add(_RequestAction(orderId: orderId, windowHours: status.windowHours));
    } else if (request == null && status.ineligibleReason != null) {
      blocks.add(
        _Notice(
          tone: _Tone.neutral,
          icon: Icons.info_outline_rounded,
          title: 'Cancellation unavailable',
          body: status.ineligibleReason!,
        ),
      );
    }

    if (blocks.isEmpty) return const SizedBox.shrink();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: blocks);
  }
}

/// The button plus the one line of context that stops it being mistaken for a
/// cancel button.
class _RequestAction extends ConsumerStatefulWidget {
  const _RequestAction({required this.orderId, required this.windowHours});

  final String orderId;
  final int windowHours;

  @override
  ConsumerState<_RequestAction> createState() => _RequestActionState();
}

class _RequestActionState extends ConsumerState<_RequestAction> {
  bool _busy = false;

  Future<void> _open() async {
    setState(() => _busy = true);
    final CancellationOutcome? outcome = await showModalBottomSheet<CancellationOutcome>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (BuildContext sheetContext) => _RequestSheet(orderId: widget.orderId),
    );

    if (!mounted) return;
    setState(() => _busy = false);
    if (outcome == null) return;

    // Grabbed before the invalidation, which can rebuild this subtree out of
    // existence on the next frame.
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    invalidateOrder(ref, widget.orderId);
    messenger.showSnackBar(
      // The API's own wording — "received … we will confirm shortly", never
      // "cancelled". SPEC-06 R1.
      SnackBar(content: Text(outcome.message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        OutlinedButton.icon(
          onPressed: _busy ? null : _open,
          icon: const Icon(Icons.block_flipped, size: 18),
          label: const Text('Request cancellation'),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          widget.windowHours > 0
              ? 'Branch staff review every request. Cancellation is only available '
                  'within ${widget.windowHours} hours of placing an order.'
              : 'Branch staff review every request.',
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
        ),
      ],
    );
  }
}

/// The reason sheet. Submits, and hands the API's reply back to the caller.
class _RequestSheet extends ConsumerStatefulWidget {
  const _RequestSheet({required this.orderId});

  final String orderId;

  @override
  ConsumerState<_RequestSheet> createState() => _RequestSheetState();
}

class _RequestSheetState extends ConsumerState<_RequestSheet> {
  final TextEditingController _reason = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final CancellationOutcome outcome = await ref
          .read(ordersRepositoryProvider)
          .requestCancellation(widget.orderId, reason: _reason.text);
      if (!mounted) return;
      Navigator.of(context).pop(outcome);
    } catch (error) {
      // 400 outside the window / already dispatched, 409 already pending. The
      // server writes copy a customer can act on; show it rather than a
      // generic failure.
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error is ApiException
            ? error.message
            : 'Could not submit that request. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.lg,
        right: AppSpacing.lg,
        top: AppSpacing.lg,
        bottom: AppSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Request cancellation', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This sends a request to your branch — it does not cancel the order. '
            'Staff review it and you will be told the outcome by SMS and email.',
            style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _reason,
            enabled: !_submitting,
            maxLines: 3,
            maxLength: 500,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Reason (optional)',
              hintText: 'e.g. Ordered the wrong frame size',
            ),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            _Notice(
              tone: _Tone.danger,
              icon: Icons.error_outline_rounded,
              title: 'Request not submitted',
              body: _error!,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Send request'),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: _submitting ? null : () => Navigator.of(context).pop(),
            child: const Text('Keep my order'),
          ),
        ],
      ),
    );
  }
}

enum _Tone { neutral, warning, danger }

/// A tinted, bordered block — the shape every cancellation state is rendered in.
class _Notice extends StatelessWidget {
  const _Notice({
    required this.tone,
    required this.icon,
    required this.title,
    required this.body,
    this.footnote,
    this.action,
  });

  final _Tone tone;
  final IconData icon;
  final String title;
  final String body;
  final String? footnote;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Color color = switch (tone) {
      _Tone.neutral => theme.colorScheme.outline,
      _Tone.warning => AppColors.warning,
      _Tone.danger => AppColors.danger,
    };

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
          Icon(icon, size: 20, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(body, style: theme.textTheme.bodyMedium),
                if (footnote != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    footnote!,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
                if (action != null) ...<Widget>[
                  const SizedBox(height: AppSpacing.xs),
                  Align(alignment: Alignment.centerLeft, child: action!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
