import 'package:flutter/material.dart';

import '../../../../core/models/money.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/payments_repository.dart';
import '../../domain/checkout_draft.dart';
import '../../domain/order.dart';
import '../../domain/payment_attempt.dart';
import 'payment_method_picker.dart';

/// The payment half of checkout, once the order exists.
///
/// Renders [PaymentPhase] as four distinct customer-facing states, and — this
/// is the part that matters — every recovery action it offers acts on the
/// order that already exists. There is no control here that can place another
/// one (SPEC-11 P0-4).
class PaymentPanel extends StatelessWidget {
  const PaymentPanel({
    super.key,
    required this.order,
    required this.attempt,
    required this.method,
    required this.defaultPhone,
    required this.onMethodChanged,
    required this.onStartMpesa,
    required this.onStartPesapal,
    required this.onRecheck,
  });

  final Order order;
  final PaymentAttempt attempt;
  final PaymentMethodOption method;

  /// Seeds the M-Pesa field from the delivery phone. Editable, because the
  /// number paying is not always the number receiving.
  final String defaultPhone;

  final ValueChanged<PaymentMethodOption> onMethodChanged;
  final ValueChanged<String> onStartMpesa;
  final VoidCallback onStartPesapal;
  final VoidCallback onRecheck;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _OrderBanner(order: order),
        const SizedBox(height: AppSpacing.lg),
        switch (attempt.phase) {
          PaymentPhase.idle => _MethodStep(
            method: method,
            defaultPhone: defaultPhone,
            onMethodChanged: onMethodChanged,
            onStartMpesa: onStartMpesa,
            onStartPesapal: onStartPesapal,
          ),
          PaymentPhase.initiating => _Waiting(
            title: method == PaymentMethodOption.mpesa
                ? 'Sending the M-Pesa request…'
                : 'Opening the secure payment window…',
            detail: attempt.message,
          ),
          PaymentPhase.pending => _Waiting(
            title: method == PaymentMethodOption.mpesa
                ? 'Waiting for your M-Pesa PIN'
                : 'Confirming with Pesapal',
            detail: attempt.message,
            attempt: attempt.attempt,
            onRecheck: attempt.busy ? null : onRecheck,
          ),
          PaymentPhase.success => _Resolved(
            icon: Icons.check_circle_rounded,
            tone: AppColors.success,
            title: 'Payment confirmed',
            detail:
                attempt.message ?? 'Thank you — your order is being processed.',
          ),
          PaymentPhase.failed => _Recoverable(
            icon: Icons.error_outline_rounded,
            tone: theme.colorScheme.error,
            title: 'That payment did not go through',
            // Provider copy: "Request cancelled by user", "Insufficient
            // balance", and so on. Shown as written rather than flattened
            // into a generic failure.
            detail: attempt.message ?? 'No money has left your account.',
            reassurance:
                'Nothing was charged. Your order is still waiting — '
                'trying again pays for this same order.',
            attempt: attempt,
            method: method,
            defaultPhone: defaultPhone,
            onMethodChanged: onMethodChanged,
            onStartMpesa: onStartMpesa,
            onStartPesapal: onStartPesapal,
            onRecheck: onRecheck,
          ),
          PaymentPhase.timedOut => _Recoverable(
            icon: Icons.hourglass_empty_rounded,
            tone: AppColors.warning,
            title: 'Still waiting on confirmation',
            detail:
                attempt.message ??
                "We haven't had an answer from the payment provider yet.",
            reassurance:
                'Check again before paying a second time — a '
                'payment that went through will show up here.',
            attempt: attempt,
            method: method,
            defaultPhone: defaultPhone,
            onMethodChanged: onMethodChanged,
            onStartMpesa: onStartMpesa,
            onStartPesapal: onStartPesapal,
            onRecheck: onRecheck,
          ),
        },
      ],
    );
  }
}

/// Which order is being paid for, and for how much.
///
/// Always visible during payment. It is the thing that makes "you are not
/// about to be charged twice" checkable rather than merely stated.
class _OrderBanner extends StatelessWidget {
  const _OrderBanner({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Order ${order.orderNumber}',
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  '${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'} · '
                  '${order.isPickup ? 'Branch pickup' : 'Delivery'}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
          Text(
            formatKes(order.totalKes),
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pick a rail and start.
class _MethodStep extends StatelessWidget {
  const _MethodStep({
    required this.method,
    required this.defaultPhone,
    required this.onMethodChanged,
    required this.onStartMpesa,
    required this.onStartPesapal,
  });

  final PaymentMethodOption method;
  final String defaultPhone;
  final ValueChanged<PaymentMethodOption> onMethodChanged;
  final ValueChanged<String> onStartMpesa;
  final VoidCallback onStartPesapal;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('How would you like to pay?', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.md),
        PaymentMethodPicker(selected: method, onChanged: onMethodChanged),
        const SizedBox(height: AppSpacing.md),
        if (method == PaymentMethodOption.mpesa)
          MpesaPhoneField(initialPhone: defaultPhone, onSubmit: onStartMpesa)
        else
          FilledButton.icon(
            onPressed: onStartPesapal,
            icon: const Icon(Icons.lock_outline_rounded),
            label: const Text('Continue to Pesapal'),
          ),
      ],
    );
  }
}

/// The M-Pesa number and the button that prompts it.
class MpesaPhoneField extends StatefulWidget {
  const MpesaPhoneField({
    super.key,
    required this.initialPhone,
    required this.onSubmit,
    this.label = 'Send the M-Pesa request',
  });

  final String initialPhone;
  final ValueChanged<String> onSubmit;
  final String label;

  @override
  State<MpesaPhoneField> createState() => _MpesaPhoneFieldState();
}

class _MpesaPhoneFieldState extends State<MpesaPhoneField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initialPhone,
  );
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final String phone = _controller.text.trim();
    // Only a "did you type a number at all" check. The real normalisation and
    // validation are `normalizeKenyanMsisdn`'s, server-side, and its rejection
    // message is the one the customer sees.
    if (phone.replaceAll(RegExp(r'\D'), '').length < 9) {
      setState(
        () => _error = 'Enter the M-Pesa number to charge, e.g. 0712345678.',
      );
      return;
    }
    setState(() => _error = null);
    widget.onSubmit(phone);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextField(
          controller: _controller,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'M-Pesa number',
            hintText: '07XX XXX XXX',
            errorText: _error,
          ),
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'You can pay from a different number — up to $kMaxStkDestinations per order.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.phone_iphone_rounded),
          label: Text(widget.label),
        ),
      ],
    );
  }
}

/// Pending / initiating.
class _Waiting extends StatelessWidget {
  const _Waiting({
    required this.title,
    this.detail,
    this.attempt,
    this.onRecheck,
  });

  final String title;
  final String? detail;
  final int? attempt;
  final VoidCallback? onRecheck;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      children: <Widget>[
        const SizedBox(height: AppSpacing.md),
        const CircularProgressIndicator(strokeWidth: 2.5),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: theme.textTheme.titleSmall,
          textAlign: TextAlign.center,
        ),
        if (detail != null && detail!.isNotEmpty) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Text(
            detail!,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
        if (attempt != null && attempt! > 0) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Checked $attempt ${attempt == 1 ? 'time' : 'times'}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
        if (onRecheck != null) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          TextButton(onPressed: onRecheck, child: const Text('Check now')),
        ],
        const SizedBox(height: AppSpacing.md),
        Text(
          'Keep this screen open. If you leave the app we will re-check when '
          'you come back.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ],
    );
  }
}

/// Success — terminal, no actions. The screen navigates on from here.
class _Resolved extends StatelessWidget {
  const _Resolved({
    required this.icon,
    required this.tone,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final Color tone;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Column(
      children: <Widget>[
        Icon(icon, size: 48, color: tone),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          detail,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ],
    );
  }
}

/// Failed or timed out — the two states with a way forward.
///
/// The three affordances are deliberately ordered cheapest-first: ask again,
/// then send another prompt, then change rail. All three act on the existing
/// order.
class _Recoverable extends StatelessWidget {
  const _Recoverable({
    required this.icon,
    required this.tone,
    required this.title,
    required this.detail,
    required this.reassurance,
    required this.attempt,
    required this.method,
    required this.defaultPhone,
    required this.onMethodChanged,
    required this.onStartMpesa,
    required this.onStartPesapal,
    required this.onRecheck,
  });

  final IconData icon;
  final Color tone;
  final String title;
  final String detail;
  final String reassurance;
  final PaymentAttempt attempt;
  final PaymentMethodOption method;
  final String defaultPhone;
  final ValueChanged<PaymentMethodOption> onMethodChanged;
  final ValueChanged<String> onStartMpesa;
  final VoidCallback onStartPesapal;
  final VoidCallback onRecheck;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool canRecheck =
        attempt.checkoutRequestId != null || attempt.orderTrackingId != null;
    final PaymentMethodOption other = method == PaymentMethodOption.mpesa
        ? PaymentMethodOption.pesapal
        : PaymentMethodOption.mpesa;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Icon(icon, size: 44, color: tone),
        const SizedBox(height: AppSpacing.md),
        Text(
          title,
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          detail,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          reassurance,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (canRecheck)
          OutlinedButton.icon(
            onPressed: attempt.busy ? null : onRecheck,
            icon: attempt.busy
                ? const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
            label: const Text('Check again'),
          ),
        const SizedBox(height: AppSpacing.sm),
        if (method == PaymentMethodOption.mpesa)
          MpesaPhoneField(
            initialPhone: defaultPhone,
            onSubmit: onStartMpesa,
            label: 'Send the request again',
          )
        else
          FilledButton.icon(
            onPressed: onStartPesapal,
            icon: const Icon(Icons.lock_outline_rounded),
            label: const Text('Open Pesapal again'),
          ),
        const SizedBox(height: AppSpacing.md),
        TextButton(
          onPressed: attempt.busy ? null : () => onMethodChanged(other),
          child: Text('Pay with ${other.label} instead'),
        ),
      ],
    );
  }
}
