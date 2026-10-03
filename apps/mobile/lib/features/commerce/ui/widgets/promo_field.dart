import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/cart.dart';

/// Promo code entry, and the applied-promo chip that replaces it.
///
/// Validation is entirely the server's: an unusable code comes back with the
/// reason already written ("This promo code has expired.", "…has reached its
/// usage limit.", "Promo code not found."), which is shown under the field
/// verbatim. Because `POST /cart/apply-promo` throws before it writes, a
/// rejected code leaves the cart — and therefore the total on screen —
/// exactly as it was.
class PromoField extends StatefulWidget {
  const PromoField({
    super.key,
    required this.promo,
    required this.onApply,
    required this.onClear,
    this.busy = false,
    this.errorText,
  });

  final AppliedPromo? promo;

  /// Returns the server's message on failure, or null on success.
  final Future<String?> Function(String code) onApply;
  final Future<void> Function() onClear;
  final bool busy;
  final String? errorText;

  @override
  State<PromoField> createState() => _PromoFieldState();
}

class _PromoFieldState extends State<PromoField> {
  final TextEditingController _controller = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final String code = _controller.text.trim();
    if (code.isEmpty) {
      setState(() => _error = 'Enter a promo code first.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final String? failure = await widget.onApply(code);
    if (!mounted) return;
    setState(() {
      _submitting = false;
      _error = failure;
      if (failure == null) _controller.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final AppliedPromo? promo = widget.promo;
    final String? error = _error ?? widget.errorText;

    if (promo != null) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: <Widget>[
            const Icon(
              Icons.local_offer_outlined,
              size: 18,
              color: AppColors.success,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                '${promo.code} applied',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: widget.busy ? null : () => widget.onClear(),
              child: const Text('Remove'),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _controller,
                textCapitalization: TextCapitalization.characters,
                textInputAction: TextInputAction.done,
                enabled: !_submitting && !widget.busy,
                decoration: const InputDecoration(hintText: 'Promo code'),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            SizedBox(
              height: AppSpacing.minTapTarget,
              child: OutlinedButton(
                onPressed: (_submitting || widget.busy) ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Apply'),
              ),
            ),
          ],
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              error,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ),
      ],
    );
  }
}
