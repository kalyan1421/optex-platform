import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../data/checkout_repository.dart';
import '../domain/checkout_draft.dart';
import '../domain/order.dart';
import 'cart_providers.dart';
import 'payment_providers.dart';

final Provider<CheckoutRepository> checkoutRepositoryProvider =
    Provider<CheckoutRepository>(
      (Ref ref) => CheckoutRepository(ref.watch(apiClientProvider)),
    );

/// The customer's saved addresses, for prefilling the form. Never fatal — the
/// repository swallows its own failure and returns an empty list.
final FutureProvider<List<SavedAddress>> savedAddressesProvider =
    FutureProvider<List<SavedAddress>>(
      (Ref ref) => ref.watch(checkoutRepositoryProvider).savedAddresses(),
    );

/// One order, read fresh from the server.
///
/// The confirmation screen fetches by id rather than reading
/// [checkoutControllerProvider]'s copy, so it works for a deep link, a push
/// notification and a relaunch — not only for the session that placed it.
/// Named for this slice to leave `orderDetailProvider` free for the orders
/// feature (SPEC-11 P0-5).
// Type left to inference: `FutureProviderFamily` is not among the symbols
// flutter_riverpod re-exports, so it cannot be written down here.
final confirmationOrderProvider = FutureProvider.family<Order, String>(
  (Ref ref, String orderId) =>
      ref.watch(checkoutRepositoryProvider).fetchOrder(orderId),
);

/// Branches available for pickup. Loaded lazily — a customer who is having it
/// delivered never triggers the call.
final FutureProvider<List<PickupBranch>> pickupBranchesProvider =
    FutureProvider<List<PickupBranch>>(
      (Ref ref) => ref.watch(checkoutRepositoryProvider).pickupBranches(),
    );

/// Checkout as the customer sees it: a form, then an order, then a payment.
class CheckoutState {
  const CheckoutState({
    this.delivery = DeliveryOption.delivery,
    this.method = PaymentMethodOption.mpesa,
    this.order,
    this.placing = false,
    this.error,
    this.stockRejection,
    this.notice,
  });

  final DeliveryOption delivery;
  final PaymentMethodOption method;

  /// The order, once `POST /checkout` has succeeded.
  ///
  /// Its presence is the single fact that stops a second order being created.
  /// Every retry, every change of payment method, every resume after the app
  /// was backgrounded pays for *this* order.
  final Order? order;

  final bool placing;

  /// A server-written failure from `POST /checkout`.
  final String? error;

  /// The stock guard's 409 message, held separately because it gets its own
  /// treatment: it names the item and the only useful action is "go fix the
  /// cart", not "try again".
  final String? stockRejection;

  /// An informational line — e.g. an order that turned out to be already paid,
  /// or one that is no longer payable.
  final String? notice;

  /// True once an order exists. The address and delivery option are then fixed:
  /// they are recorded on the order server-side, and re-submitting the form
  /// would place a second one.
  bool get isLocked => order != null;

  /// True when there is an order still waiting to be paid for.
  bool get hasPayableOrder => order != null && order!.awaitsPayment;

  CheckoutState copyWith({
    DeliveryOption? delivery,
    PaymentMethodOption? method,
    Order? order,
    bool? placing,
    String? error,
    String? stockRejection,
    String? notice,
    bool clearOrder = false,
    bool clearMessages = false,
  }) => CheckoutState(
    delivery: delivery ?? this.delivery,
    method: method ?? this.method,
    order: clearOrder ? null : (order ?? this.order),
    placing: placing ?? this.placing,
    error: clearMessages ? null : (error ?? this.error),
    stockRejection: clearMessages
        ? null
        : (stockRejection ?? this.stockRejection),
    notice: clearMessages ? null : (notice ?? this.notice),
  );
}

/// Owns the checkout form and, crucially, the order it produced.
///
/// **This provider is keep-alive on purpose.** If it disposed with the
/// checkout screen, a customer who backgrounded the app mid-payment, or who
/// stepped back to the cart to check something, would return to an empty
/// checkout and place a second order for a basket that had already been
/// ordered. Holding the order id for the session is what makes "retry or
/// switch method without creating a second order" (SPEC-11 P0-4) structurally
/// true rather than a thing the UI politely tries not to do.
class CheckoutController extends Notifier<CheckoutState> {
  @override
  CheckoutState build() => const CheckoutState();

  CheckoutRepository get _repo => ref.read(checkoutRepositoryProvider);

  void selectDelivery(DeliveryOption option) {
    if (state.isLocked) return;
    state = state.copyWith(delivery: option);
  }

  /// Switches the rail. Legal at any time, including after the order exists:
  /// `assertPayable` only checks that the order is unpaid and still
  /// `pending_payment`, not which method it was created with, and a successful
  /// charge overwrites `payment_method` with whichever rail actually paid.
  void selectMethod(PaymentMethodOption option) =>
      state = state.copyWith(method: option);

  void clearMessages() => state = state.copyWith(clearMessages: true);

  /// Places the order — at most once per basket.
  ///
  /// Returns the existing order untouched if there already is one. This early
  /// return is the whole safety property: every caller (first attempt, retry
  /// after a timeout, switch from M-Pesa to Pesapal) funnels through here, and
  /// only the first one reaches `POST /checkout`.
  Future<Order?> placeOrder(ShippingAddress address) async {
    final Order? existing = state.order;
    if (existing != null) return existing;
    if (state.placing) return null;

    state = state.copyWith(placing: true, clearMessages: true);
    try {
      final CheckoutResult result = await _repo.placeOrder(
        method: state.method,
        address: address,
        delivery: state.delivery,
        // Sent from the cart's applied promo because `place_order` does not
        // read the cart's stored code — it only applies what checkout passes.
        // Omitting it is how the web checkout once billed the undiscounted
        // total. The server re-validates it regardless.
        promoCode: ref.read(cartControllerProvider).value?.promo?.code,
      );

      // The cart is emptied server-side inside the same transaction, so the
      // local copy is stale the moment this returns.
      unawaited(ref.read(cartControllerProvider.notifier).refresh());

      state = state.copyWith(order: result.order, placing: false);
      return result.order;
    } on ApiException catch (e) {
      // 409 is the stock guard (0020) or a race in `deduct_stock_fifo`. Its
      // message names the item and the shortfall; it is shown verbatim.
      final bool isStock = e.statusCode == 409;
      state = state.copyWith(
        placing: false,
        error: isStock ? null : e.message,
        stockRejection: isStock ? e.message : null,
      );
      return null;
    }
  }

  /// Re-reads the order from the server.
  ///
  /// Called when the payment screen appears and whenever the app comes back to
  /// the foreground. The webhook and the reconciliation cron both credit
  /// orders independently of anything the app does, so the order — not the
  /// app's polling — is the authority on whether it has been paid.
  Future<Order?> refreshOrder() async {
    final Order? current = state.order;
    if (current == null) return null;
    try {
      final Order fresh = await _repo.fetchOrder(current.id);
      // Rebuilt rather than copied so a notice that no longer applies is
      // genuinely gone: `copyWith` reads null as "leave it alone".
      state = CheckoutState(
        delivery: state.delivery,
        method: state.method,
        order: fresh,
        notice: fresh.awaitsPayment
            ? null
            : fresh.isPaid
            ? 'Payment confirmed for order ${fresh.orderNumber}.'
            : 'Order ${fresh.orderNumber} is no longer awaiting payment '
                  '(${fresh.status.replaceAll('_', ' ')}).',
      );
      return fresh;
    } on ApiException {
      // Leave the last known order in place. A failed refresh is a network
      // problem, not evidence that the order changed.
      return current;
    }
  }

  /// Forgets the current order so the next checkout creates a new one.
  ///
  /// Only ever called from an explicit, confirmed customer action ("start a
  /// new order"), never automatically: the order still exists server-side as
  /// an unpaid `pending_payment` row, and walking away from one silently is
  /// how a customer ends up with two.
  void startOver() => _clear();

  /// Clears everything after a successful payment.
  void completed() => _clear();

  /// Drops the order **and** the payment attempt together.
  ///
  /// These two must move as one. `PaymentController._alreadyPaid` queries
  /// whatever `checkoutRequestId` / `orderTrackingId` sit in its state, and
  /// those belong to the order being abandoned here. Left behind, the next
  /// order's first payment attempt asks the provider about the *previous*
  /// order's id, is told it was paid, and marks a new and entirely unpaid
  /// order as successful.
  ///
  /// This used to be two calls every caller had to remember to pair. The one
  /// that eventually forgot would have shipped that bug, so the pairing lives
  /// here instead.
  void _clear() {
    ref.read(paymentControllerProvider.notifier).reset();
    state = const CheckoutState();
  }
}

final NotifierProvider<CheckoutController, CheckoutState>
checkoutControllerProvider =
    NotifierProvider<CheckoutController, CheckoutState>(CheckoutController.new);
