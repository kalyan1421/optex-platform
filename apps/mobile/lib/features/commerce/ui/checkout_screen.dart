import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/cart.dart';
import '../domain/checkout_draft.dart';
import '../domain/order.dart';
import '../domain/payment_attempt.dart';
import '../state/cart_providers.dart';
import '../state/checkout_providers.dart';
import '../state/payment_providers.dart';
import 'pesapal_webview_screen.dart';
import 'widgets/money_summary.dart';
import 'widgets/payment_method_picker.dart';
import 'widgets/payment_panel.dart';
import 'widgets/shipping_address_form.dart';

/// Checkout, in two stages: fill the form, then pay for the order it created.
///
/// The stage is decided by one thing — whether an order exists — and that
/// decision lives in [CheckoutController], not here. Which is why nothing on
/// this screen, on any path, can produce a second order for the same basket:
/// once `state.order` is set the form is gone and every button acts on that
/// order (SPEC-11 P0-4).
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen>
    with WidgetsBindingObserver {
  final GlobalKey<ShippingAddressFormState> _formKey =
      GlobalKey<ShippingAddressFormState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // An order may be waiting from earlier in the session — the customer went
    // back to the cart, or the app was killed and relaunched. Ask the server
    // what state it is in before offering to pay for it again.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(checkoutControllerProvider.notifier).refreshOrder();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Re-queries on return to the foreground.
  ///
  /// Reading an M-Pesa SMS means leaving the app, so being backgrounded is the
  /// *normal* path through a payment, not an edge case. Both the attempt and
  /// the order are re-read: the attempt because our poll timer may have been
  /// frozen, and the order because the Daraja webhook may have credited it
  /// while we were away (SPEC-11 P0-4).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    ref.read(paymentControllerProvider.notifier).onAppResumed();
    ref.read(checkoutControllerProvider.notifier).refreshOrder();
  }

  Future<void> _placeOrder() async {
    final ShippingAddressFormState? form = _formKey.currentState;
    final ShippingAddress? address = form?.read();
    if (address == null) {
      if (form?.isMissingBranch ?? false) {
        _snack('Choose the branch you want to collect from.');
      }
      return;
    }
    await ref.read(checkoutControllerProvider.notifier).placeOrder(address);
  }

  Future<void> _startMpesa(String phone) async {
    final String? orderId = ref.read(checkoutControllerProvider).order?.id;
    if (orderId == null) return;
    await ref
        .read(paymentControllerProvider.notifier)
        .startMpesa(orderId: orderId, phone: phone);
  }

  /// Opens Pesapal, then confirms with our own server.
  ///
  /// The webview is pushed onto the [Navigator] rather than routed through
  /// go_router: it is a modal step inside checkout, not a place a customer
  /// should ever be able to deep-link to or land on via back navigation.
  Future<void> _startPesapal() async {
    final String? orderId = ref.read(checkoutControllerProvider).order?.id;
    if (orderId == null) return;

    final PaymentController payments = ref.read(
      paymentControllerProvider.notifier,
    );
    final String? url = await payments.startPesapal(orderId);
    if (!mounted || url == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (BuildContext context) =>
            PesapalWebViewScreen(redirectUrl: url),
        fullscreenDialog: true,
      ),
    );
    if (!mounted) return;

    // However that window closed — paid, abandoned, crashed — the outcome is
    // decided here, server-side.
    await payments.confirmPesapal();
  }

  Future<void> _confirmStartOver(Order order) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Start a new order?'),
        content: Text(
          'Order ${order.orderNumber} has already been created and is waiting '
          'for payment. Starting over leaves it unpaid — our team will need to '
          'cancel it for you. Pay for it instead if you can.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep paying'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Start a new order'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    // startOver() resets the payment attempt too — see CheckoutController.
    ref.read(checkoutControllerProvider.notifier).startOver();
    ref.read(cartControllerProvider.notifier).refresh();
  }

  /// Asked when the customer tries to leave with a payment in flight.
  ///
  /// Not a block — both the order and the attempt survive leaving, and holding
  /// someone hostage on a spinner is its own failure. It is a warning, because
  /// walking away from a live STK prompt and starting again is exactly how
  /// someone ends up paying twice.
  Future<void> _confirmLeaveDuringPayment() async {
    final bool? leave = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Leave while paying?'),
        content: const Text(
          "Your payment is still being confirmed. You can come back to this "
          'order and finish — nothing is lost, and you will not be charged '
          'twice. Please do not start a new order in the meantime.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Stay here'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (leave != true || !mounted) return;
    // The attempt keeps polling in the background and the order is untouched;
    // returning to /checkout picks both up exactly where they were.
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.cart);
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// Leaves the success panel on screen for a beat, then moves on to the
  /// confirmation — which is a `go`, so the payment screen is not behind it.
  void _onPaid(String orderId) {
    Future<void>.delayed(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      // completed() resets the payment attempt too.
      ref.read(checkoutControllerProvider.notifier).completed();
      ref.read(cartControllerProvider.notifier).refresh();
      context.go(Routes.orderConfirmationOf(orderId));
    });
  }

  @override
  Widget build(BuildContext context) {
    final CheckoutState checkout = ref.watch(checkoutControllerProvider);
    final PaymentAttempt attempt = ref.watch(paymentControllerProvider);
    final AsyncValue<Cart> cartAsync = ref.watch(cartControllerProvider);

    ref.listen<PaymentAttempt>(paymentControllerProvider, (
      PaymentAttempt? previous,
      PaymentAttempt next,
    ) {
      if (next.phase != PaymentPhase.success) return;
      if (previous?.phase == PaymentPhase.success) return;
      final String? orderId =
          next.orderId ?? ref.read(checkoutControllerProvider).order?.id;
      if (orderId != null) _onPaid(orderId);
    });

    final bool paymentInFlight =
        attempt.phase == PaymentPhase.initiating ||
        attempt.phase == PaymentPhase.pending;

    return PopScope(
      // Leaving mid-payment is allowed — the order and the attempt both
      // survive it — but it deserves a warning, because a customer who walks
      // away from a live STK prompt and starts again is the person most likely
      // to pay twice.
      canPop: !paymentInFlight,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        _confirmLeaveDuringPayment();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Checkout')),
        body: checkout.order != null
            ? _PaymentStage(
                order: checkout.order!,
                checkout: checkout,
                attempt: attempt,
                defaultPhone:
                    _formKey.currentState?.phone ??
                    checkout.order!.shipping?.phone ??
                    '',
                onMethodChanged: (PaymentMethodOption method) {
                  ref
                      .read(checkoutControllerProvider.notifier)
                      .selectMethod(method);
                  ref.read(paymentControllerProvider.notifier).reselect();
                },
                onStartMpesa: _startMpesa,
                onStartPesapal: _startPesapal,
                onRecheck: () =>
                    ref.read(paymentControllerProvider.notifier).recheck(),
                onStartOver: () => _confirmStartOver(checkout.order!),
              )
            : cartAsync.when(
                loading: () => const AppLoading(label: 'Loading your cart…'),
                error: (Object error, StackTrace stack) => AppErrorView(
                  error: error,
                  onRetry: () =>
                      ref.read(cartControllerProvider.notifier).refresh(),
                ),
                data: (Cart cart) => cart.isEmpty
                    ? AppEmptyState(
                        title: 'Nothing to check out',
                        message:
                            'Your cart is empty. Add something from the '
                            'shop and come back.',
                        icon: Icons.shopping_bag_outlined,
                        action: FilledButton(
                          onPressed: () => context.go(Routes.shop),
                          child: const Text('Start shopping'),
                        ),
                      )
                    : _FormStage(
                        formKey: _formKey,
                        cart: cart,
                        checkout: checkout,
                        onPlaceOrder: _placeOrder,
                      ),
              ),
      ),
    );
  }
}

/// Stage one: where it goes, how it is paid for, and the button that commits.
class _FormStage extends ConsumerWidget {
  const _FormStage({
    required this.formKey,
    required this.cart,
    required this.checkout,
    required this.onPlaceOrder,
  });

  final GlobalKey<ShippingAddressFormState> formKey;
  final Cart cart;
  final CheckoutState checkout;
  final Future<void> Function() onPlaceOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CheckoutController controller = ref.read(
      checkoutControllerProvider.notifier,
    );
    final String? customerName = ref
        .watch(authControllerProvider)
        .user
        ?.fullName;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: <Widget>[
        if (checkout.stockRejection != null) ...<Widget>[
          _Banner(
            icon: Icons.inventory_2_outlined,
            tone: theme.colorScheme.error,
            // Verbatim from the server. `place_order`'s stock guard raises
            // `insufficient_stock:<product>:<wanted>:<available>` and the API
            // turns it into a sentence naming the item and the shortfall —
            // the only part of this the customer can act on.
            message: checkout.stockRejection!,
            action: TextButton(
              onPressed: () => context.go(Routes.cart),
              child: const Text('Review cart'),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        if (checkout.error != null) ...<Widget>[
          _Banner(
            icon: Icons.error_outline_rounded,
            tone: theme.colorScheme.error,
            message: checkout.error!,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Text('Delivery', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        SegmentedButton<DeliveryOption>(
          segments: <ButtonSegment<DeliveryOption>>[
            for (final DeliveryOption option in DeliveryOption.values)
              ButtonSegment<DeliveryOption>(
                value: option,
                label: Text(option.label),
              ),
          ],
          selected: <DeliveryOption>{checkout.delivery},
          onSelectionChanged: (Set<DeliveryOption> selection) =>
              controller.selectDelivery(selection.first),
        ),
        const SizedBox(height: AppSpacing.lg),
        ShippingAddressForm(
          key: formKey,
          delivery: checkout.delivery,
          initialName: customerName,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text('Payment', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        PaymentMethodPicker(
          selected: checkout.method,
          onChanged: controller.selectMethod,
        ),
        const SizedBox(height: AppSpacing.lg),
        MoneySummary(
          rows: cart.summaryRows,
          footnote: checkout.delivery == DeliveryOption.pickup
              ? 'Collection is free. The final total is confirmed when the '
                    'order is placed.'
              : 'Delivery is added when the order is placed, along with the '
                    'final total.',
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(
          onPressed: checkout.placing ? null : () => onPlaceOrder(),
          child: checkout.placing
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Place order'),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Placing the order does not charge you. You choose how to pay on the '
          'next step.',
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
      ],
    );
  }
}

/// Stage two: the order exists; pay for it.
class _PaymentStage extends StatelessWidget {
  const _PaymentStage({
    required this.order,
    required this.checkout,
    required this.attempt,
    required this.defaultPhone,
    required this.onMethodChanged,
    required this.onStartMpesa,
    required this.onStartPesapal,
    required this.onRecheck,
    required this.onStartOver,
  });

  final Order order;
  final CheckoutState checkout;
  final PaymentAttempt attempt;
  final String defaultPhone;
  final ValueChanged<PaymentMethodOption> onMethodChanged;
  final ValueChanged<String> onStartMpesa;
  final VoidCallback onStartPesapal;
  final VoidCallback onRecheck;
  final VoidCallback onStartOver;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    // The order stopped being payable while we were looking at it — paid by a
    // webhook, or cancelled. Offering "pay now" here would only earn a 409.
    if (!order.awaitsPayment && attempt.phase != PaymentPhase.success) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: <Widget>[
          _Banner(
            icon: order.isPaid
                ? Icons.check_circle_outline_rounded
                : Icons.info_outline_rounded,
            tone: order.isPaid ? AppColors.success : AppColors.warning,
            message:
                checkout.notice ??
                'Order ${order.orderNumber} is no longer awaiting payment.',
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: () => context.go(Routes.orderConfirmationOf(order.id)),
            child: const Text('View your order'),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: <Widget>[
        if (checkout.notice != null) ...<Widget>[
          _Banner(
            icon: Icons.info_outline_rounded,
            tone: AppColors.info,
            message: checkout.notice!,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        PaymentPanel(
          order: order,
          attempt: attempt,
          method: checkout.method,
          defaultPhone: defaultPhone,
          onMethodChanged: onMethodChanged,
          onStartMpesa: onStartMpesa,
          onStartPesapal: onStartPesapal,
          onRecheck: onRecheck,
        ),
        if (attempt.isRecoverable ||
            attempt.phase == PaymentPhase.idle) ...<Widget>[
          const SizedBox(height: AppSpacing.xl),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Trying again always pays for order ${order.orderNumber}. A new '
            'order is only created if you explicitly ask for one.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: onStartOver,
            child: const Text('Start a new order'),
          ),
        ],
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.tone,
    required this.message,
    this.action,
  });

  final IconData icon;
  final Color tone;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.10),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: tone, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message, style: theme.textTheme.bodyMedium)),
          ?action,
        ],
      ),
    );
  }
}
