import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/providers.dart';
import '../data/payments_repository.dart';
import '../domain/checkout_draft.dart';
import '../domain/payment_attempt.dart';
import 'checkout_providers.dart';

final Provider<PaymentsRepository> paymentsRepositoryProvider =
    Provider<PaymentsRepository>(
      (Ref ref) => PaymentsRepository(ref.watch(apiClientProvider)),
    );

/// Drives one payment attempt against one order, on either rail.
///
/// Keep-alive, like [checkoutControllerProvider], and for the same reason: an
/// attempt has to survive the customer switching apps to read an M-Pesa SMS.
///
/// The polling contract, in one place:
///
///   * Only the server may say "paid". `paid: true` comes back from a call
///     that re-queried the provider and reconciled the transaction.
///   * Only the provider may say "failed". A transport error, a 5xx, a rate
///     limit — none of those tell us anything about the money, so they are
///     logged into [PaymentAttempt.message] and the loop keeps going.
///   * Everything unresolved when the window closes is [PaymentPhase.timedOut],
///     which is recoverable and never claims an outcome.
class PaymentController extends Notifier<PaymentAttempt> {
  @override
  PaymentAttempt build() => PaymentAttempt.idle;

  /// Cancels superseded poll loops. Every loop captures the value at its start
  /// and stops the moment it no longer matches, so a retry can never have two
  /// loops writing conflicting phases into the same state.
  int _generation = 0;

  /// When the current STK attempt stops being worth waiting for.
  ///
  /// Held here rather than derived per poll loop so that resuming the app, or
  /// tapping "check again", continues the original window instead of starting
  /// a new one. Cleared whenever the attempt reaches a terminal phase.
  DateTime? _mpesaDeadline;

  bool get _mpesaWindowClosed =>
      _mpesaDeadline != null && DateTime.now().isAfter(_mpesaDeadline!);

  PaymentsRepository get _repo => ref.read(paymentsRepositoryProvider);

  /// Gaps between M-Pesa status queries. Front-loaded because most pushes
  /// resolve in the first few seconds, then stretched so a customer hunting
  /// for their phone is not costing a query a second. The last value repeats
  /// until the window closes.
  static const List<Duration> _mpesaBackoff = <Duration>[
    Duration(seconds: 3),
    Duration(seconds: 3),
    Duration(seconds: 4),
    Duration(seconds: 5),
    Duration(seconds: 6),
    Duration(seconds: 8),
    Duration(seconds: 10),
  ];

  /// How long to wait before calling an STK push unresolved. The prompt itself
  /// expires on the handset at around 60s; this leaves room for the callback
  /// to land after that.
  static const Duration _mpesaWindow = Duration(seconds: 90);

  /// Pesapal checks after the webview closes. The first is immediate — the
  /// customer has just finished paying — and the rest cover a late IPN.
  static const List<Duration> _pesapalBackoff = <Duration>[
    Duration.zero,
    Duration(seconds: 2),
    Duration(seconds: 4),
    Duration(seconds: 6),
    Duration(seconds: 8),
    Duration(seconds: 10),
  ];

  // ── M-Pesa ───────────────────────────────────────────────────────────────

  /// Sends an STK push for [orderId] and polls until it resolves.
  ///
  /// [orderId] always comes from [CheckoutController], which creates at most
  /// one order per basket. Calling this again after a timeout sends a second
  /// *prompt* for the same order — never a second order.
  Future<void> startMpesa({
    required String orderId,
    required String phone,
  }) async {
    // Claimed BEFORE the first await, and re-checked after every one. Without
    // this, a customer who taps M-Pesa and then switches to Pesapal gets the
    // in-flight STK response landing on top of the newer card attempt: both
    // rails end up live server-side, the UI tracks only the loser, and the
    // card payment is never reconciled while they are prompted to pay again.
    final int generation = ++_generation;

    if (await _alreadyPaid(generation)) return;
    if (generation != _generation) return;

    state = PaymentAttempt(
      phase: PaymentPhase.initiating,
      method: PaymentMethodOption.mpesa,
      orderId: orderId,
      busy: true,
      // Any earlier card attempt's id is carried forward, so a later
      // `_alreadyPaid` can still see it. An abandoned attempt on the other
      // rail is exactly the one worth remembering.
      orderTrackingId: state.orderTrackingId,
    );

    final MpesaPush push;
    try {
      push = await _repo.startStkPush(orderId: orderId, phone: phone);
    } on ApiException catch (e) {
      if (generation != _generation) return;
      await _initiationFailed(e);
      return;
    }

    if (generation != _generation) return;

    // The window starts when the prompt is actually sent, and is held on the
    // controller so a later recheck resumes the same window instead of
    // granting a fresh 90 seconds (see _pollMpesa).
    _mpesaDeadline = DateTime.now().add(_mpesaWindow);

    state = state.copyWith(
      phase: PaymentPhase.pending,
      checkoutRequestId: push.checkoutRequestId,
      message: push.message,
      busy: false,
      attempt: 0,
      pendingSince: DateTime.now(),
    );
    await _pollMpesa(push.checkoutRequestId);
  }

  Future<void> _pollMpesa(
    String checkoutRequestId, {
    bool immediate = false,
  }) async {
    final int generation = ++_generation;
    // The deadline belongs to the attempt, not to this loop. Recomputing it
    // here meant every resume-triggered recheck restarted the 90 seconds, so
    // a customer flicking to their SMS app and back kept the attempt alive
    // forever and never saw the recovery copy.
    final DateTime deadline =
        _mpesaDeadline ?? DateTime.now().add(_mpesaWindow);
    int attempt = 0;

    while (generation == _generation && DateTime.now().isBefore(deadline)) {
      if (!(immediate && attempt == 0)) {
        await Future<void>.delayed(_backoffAt(_mpesaBackoff, attempt));
      }
      if (generation != _generation) return;

      attempt++;
      state = state.copyWith(phase: PaymentPhase.pending, attempt: attempt);

      try {
        final MpesaStatus status = await _repo.queryMpesa(checkoutRequestId);
        if (generation != _generation) return;
        if (status.paid) {
          _succeed(status.resultDesc ?? 'Payment received. Thank you.');
          return;
        }
        if (status.isFailure) {
          _fail(
            status.resultDesc ??
                'M-Pesa reported that the payment did not go through.',
          );
          return;
        }
        // resultCode == null is Daraja's "still being processed". Keep waiting.
      } on ApiException catch (e) {
        if (generation != _generation) return;
        // Deliberately not a failure. We know nothing about the money from a
        // query that did not reach a verdict, so the loop continues and, if it
        // never does, the attempt lands in `timedOut`.
        state = state.copyWith(message: e.message);
      }
    }

    if (generation == _generation) {
      _timeOut(
        "We haven't had confirmation from M-Pesa yet. If you approved the "
        'prompt, your payment may still be going through — check again before '
        'paying twice.',
      );
    }
  }

  // ── Pesapal ──────────────────────────────────────────────────────────────

  /// Starts a Pesapal payment and returns the URL to open in the in-app
  /// webview, or null if initiation failed.
  Future<String?> startPesapal(String orderId) async {
    final int generation = ++_generation;

    if (await _alreadyPaid(generation)) return null;
    if (generation != _generation) return null;

    state = PaymentAttempt(
      phase: PaymentPhase.initiating,
      method: PaymentMethodOption.pesapal,
      orderId: orderId,
      busy: true,
      checkoutRequestId: state.checkoutRequestId,
    );

    try {
      final PesapalInitiation init = await _repo.startPesapal(orderId);
      if (generation != _generation) return null;
      state = state.copyWith(
        phase: PaymentPhase.pending,
        orderTrackingId: init.orderTrackingId,
        message: 'Complete your payment in the secure Pesapal window.',
        busy: false,
        attempt: 0,
        pendingSince: DateTime.now(),
      );
      return init.redirectUrl;
    } on ApiException catch (e) {
      if (generation != _generation) return null;
      await _initiationFailed(e);
      return null;
    }
  }

  /// Resolves a Pesapal payment **server-side** after the webview closes.
  ///
  /// Called whatever the webview did — completed, was dismissed, hit an error
  /// page. Where it ended up navigating is not evidence and is not consulted;
  /// the verdict comes from `GET /payments/pesapal/status`, which re-queries
  /// Pesapal and refuses to credit on an amount mismatch.
  Future<void> confirmPesapal() async {
    final String? trackingId = state.orderTrackingId;
    if (trackingId == null) return;

    final int generation = ++_generation;
    state = state.copyWith(phase: PaymentPhase.pending, busy: true, attempt: 0);

    for (int i = 0; i < _pesapalBackoff.length; i++) {
      await Future<void>.delayed(_pesapalBackoff[i]);
      if (generation != _generation) return;
      state = state.copyWith(attempt: i + 1);

      try {
        final PesapalStatus status = await _repo.queryPesapal(trackingId);
        if (generation != _generation) return;
        if (status.paid) {
          _succeed(status.description ?? 'Payment received. Thank you.');
          return;
        }
        if (status.isFailure) {
          _fail(
            status.description ??
                'Pesapal reported that the payment did not go through.',
          );
          return;
        }
      } on ApiException catch (e) {
        if (generation != _generation) return;
        state = state.copyWith(message: e.message);
      }
    }

    if (generation == _generation) {
      _timeOut(
        "Pesapal hasn't confirmed this payment yet. If you completed it, give "
        'it a moment and check again rather than paying a second time.',
      );
    }
  }

  // ── Recovery ─────────────────────────────────────────────────────────────

  /// Asks the server again, without starting a new payment.
  ///
  /// This is the action a customer reaches for after a timeout, and it is the
  /// cheap one: no new prompt, no new order, no new charge — just "has it
  /// landed yet?".
  Future<void> recheck() async {
    final PaymentMethodOption? method = state.method;
    if (method == null || state.busy) return;

    switch (method) {
      case PaymentMethodOption.mpesa:
        final String? id = state.checkoutRequestId;
        if (id == null) return;
        if (state.phase == PaymentPhase.pending && !_mpesaWindowClosed) {
          // Restart the loop with an immediate query rather than adding a
          // second one alongside it. Only while the window is still open —
          // past it the loop would exit instantly without ever asking.
          await _pollMpesa(id, immediate: true);
        } else {
          await _singleCheck(() async {
            final MpesaStatus status = await _repo.queryMpesa(id);
            if (status.paid) {
              return (paid: true, failed: false, detail: status.resultDesc);
            }
            return (
              paid: false,
              failed: status.isFailure,
              detail: status.resultDesc,
            );
          });
        }
      case PaymentMethodOption.pesapal:
        final String? id = state.orderTrackingId;
        if (id == null) return;
        if (state.phase == PaymentPhase.pending) {
          // Mirrors the M-Pesa branch. Falling through to _singleCheck here
          // used to kill the confirmPesapal loop via ++_generation and then,
          // on a network error, restore `pending` with nothing polling —
          // leaving a spinner that could never resolve.
          await confirmPesapal();
          return;
        }
        await _singleCheck(() async {
          final PesapalStatus status = await _repo.queryPesapal(id);
          if (status.paid) {
            return (paid: true, failed: false, detail: status.description);
          }
          return (
            paid: false,
            failed: status.isFailure,
            detail: status.description,
          );
        });
    }
  }

  Future<void> _singleCheck(
    Future<({bool paid, bool failed, String? detail})> Function() query,
  ) async {
    final int generation = ++_generation;
    final PaymentPhase previous = state.phase;
    state = state.copyWith(busy: true);
    try {
      final ({bool paid, bool failed, String? detail}) result = await query();
      if (generation != _generation) return;
      if (result.paid) {
        _succeed(result.detail ?? 'Payment received. Thank you.');
        return;
      }
      if (result.failed) {
        _fail(result.detail ?? 'The payment did not go through.');
        return;
      }
      state = state.copyWith(
        phase: previous == PaymentPhase.failed
            ? PaymentPhase.failed
            : PaymentPhase.timedOut,
        busy: false,
        // Careful wording: we know the order has not been credited, which is
        // not the same as knowing no money moved. Claiming the stronger thing
        // would be a promise this app cannot keep.
        message:
            'Still no confirmation from the provider. Your order has not '
            'been paid yet — keep checking, resend the request, or pay '
            'another way.',
      );
    } on ApiException catch (e) {
      if (generation != _generation) return;
      // Never restore `pending`: this method has already superseded whatever
      // loop was running, so `pending` would promise a poller that no longer
      // exists. `timedOut` is the honest phase — unresolved, and recoverable.
      state = state.copyWith(
        phase: previous == PaymentPhase.pending
            ? PaymentPhase.timedOut
            : previous,
        busy: false,
        message: e.message,
      );
    }
  }

  /// Puts the attempt back to [PaymentPhase.idle] so the screen offers the
  /// method picker again. The order is untouched — switching rails re-uses it.
  ///
  /// The previous rail's provider ids are deliberately kept. Someone switching
  /// from a timed-out STK push to a card is the likeliest person in this whole
  /// flow to be charged twice, and keeping the ids is what lets
  /// [_alreadyPaid] check the abandoned attempt before the new one starts.
  void reselect() {
    _generation++;
    _mpesaDeadline = null;
    state = state.copyWith(
      phase: PaymentPhase.idle,
      busy: false,
      attempt: 0,
      clearMessage: true,
    );
  }

  /// Drops the attempt entirely. Used when the order is done with.
  void reset() {
    _generation++;
    _mpesaDeadline = null;
    state = PaymentAttempt.idle;
  }

  /// Re-queries on return to the foreground.
  ///
  /// The app may have been suspended for minutes with a live STK prompt on the
  /// handset: assuming failure would be wrong, and so would trusting a timer
  /// that the OS may have frozen. Both unresolved phases therefore ask the
  /// server what actually happened (SPEC-11 P0-4).
  Future<void> onAppResumed() async {
    switch (state.phase) {
      case PaymentPhase.pending:
      case PaymentPhase.timedOut:
        await recheck();
      case PaymentPhase.idle:
      case PaymentPhase.initiating:
      case PaymentPhase.success:
      case PaymentPhase.failed:
        return;
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /// One last look at an earlier attempt before starting another.
  ///
  /// The single most expensive mistake this slice can make is sending a second
  /// STK push — or opening a second card session — for a payment that has in
  /// fact gone through. The order would be credited once (`creditOrder` is
  /// idempotent), but the customer would have been charged twice and would be
  /// owed a refund, on a platform whose stated policy is that it does not give
  /// them.
  ///
  /// So every retry and every switch of rail asks first. Both ids are checked
  /// because the previous attempt may have been on the other rail. A failed
  /// check is not treated as "not paid" — it just lets the retry through,
  /// because refusing to let someone pay on a flaky network is its own way of
  /// losing the order.
  Future<bool> _alreadyPaid(int generation) async {
    final String? mpesaId = state.checkoutRequestId;
    final String? pesapalId = state.orderTrackingId;
    if (mpesaId == null && pesapalId == null) return false;
    if (state.phase == PaymentPhase.success) return true;

    state = state.copyWith(busy: true);
    try {
      if (mpesaId != null) {
        final MpesaStatus status = await _repo.queryMpesa(mpesaId);
        if (generation != _generation) return false;
        if (status.paid) {
          _succeed(
            status.resultDesc ?? 'That payment had already gone through.',
          );
          return true;
        }
      }
      if (pesapalId != null) {
        final PesapalStatus status = await _repo.queryPesapal(pesapalId);
        if (generation != _generation) return false;
        if (status.paid) {
          _succeed(
            status.description ?? 'That payment had already gone through.',
          );
          return true;
        }
      }
    } on ApiException {
      // Unknown, not negative. Fall through and let the customer pay.
    }
    if (generation != _generation) return false;
    state = state.copyWith(busy: false);
    return false;
  }

  /// An initiation that never got off the ground: no prompt was sent, no money
  /// moved, so [PaymentPhase.failed] is honest. The one exception is a 409,
  /// which means the order is no longer payable — usually because it was just
  /// paid — so the order is re-read and the customer is not told it failed.
  Future<void> _initiationFailed(ApiException e) async {
    if (e.statusCode == 409) {
      state = state.copyWith(
        phase: PaymentPhase.timedOut,
        busy: false,
        message: e.message,
      );
      await ref.read(checkoutControllerProvider.notifier).refreshOrder();
      return;
    }
    state = state.copyWith(
      phase: PaymentPhase.failed,
      busy: false,
      message: e.message,
    );
  }

  void _succeed(String detail) {
    _generation++;
    _mpesaDeadline = null;
    state = state.copyWith(
      phase: PaymentPhase.success,
      busy: false,
      message: detail,
    );
  }

  void _fail(String detail) {
    _generation++;
    _mpesaDeadline = null;
    state = state.copyWith(
      phase: PaymentPhase.failed,
      busy: false,
      message: detail,
    );
  }

  void _timeOut(String detail) {
    _generation++;
    _mpesaDeadline = null;
    state = state.copyWith(
      phase: PaymentPhase.timedOut,
      busy: false,
      message: detail,
    );
  }

  static Duration _backoffAt(List<Duration> schedule, int attempt) =>
      schedule[attempt < schedule.length ? attempt : schedule.length - 1];
}

final NotifierProvider<PaymentController, PaymentAttempt>
paymentControllerProvider = NotifierProvider<PaymentController, PaymentAttempt>(
  PaymentController.new,
);
