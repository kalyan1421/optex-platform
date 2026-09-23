import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/features/commerce/data/payments_repository.dart';
import 'package:optex_mobile/features/commerce/domain/checkout_draft.dart';
import 'package:optex_mobile/features/commerce/domain/payment_attempt.dart';
import 'package:optex_mobile/features/commerce/state/payment_providers.dart';

/// A repository whose timing the test controls.
///
/// `implements` rather than a mock package: the surface is four methods and
/// what these tests need is precise control over *when* each future settles,
/// which is exactly the thing a race depends on.
class _FakeRepo implements PaymentsRepository {
  Completer<MpesaPush>? stkGate;
  Completer<PesapalInitiation>? pesapalGate;
  MpesaStatus? mpesaStatus;
  PesapalStatus? pesapalStatus;
  int stkCalls = 0;
  int pesapalCalls = 0;

  @override
  Future<MpesaPush> startStkPush({
    required String orderId,
    required String phone,
  }) {
    stkCalls++;
    return stkGate?.future ??
        Future<MpesaPush>.value(
          const MpesaPush(checkoutRequestId: 'CR-1', message: 'Prompt sent'),
        );
  }

  @override
  Future<MpesaStatus> queryMpesa(String checkoutRequestId) async =>
      mpesaStatus ??
      MpesaStatus(
        checkoutRequestId: checkoutRequestId,
        status: 'pending',
        paid: false,
      );

  @override
  Future<PesapalInitiation> startPesapal(String orderId) {
    pesapalCalls++;
    return pesapalGate?.future ??
        Future<PesapalInitiation>.value(
          const PesapalInitiation(
            orderTrackingId: 'OT-1',
            redirectUrl: 'https://pay.example/checkout',
            message: 'Opening Pesapal',
          ),
        );
  }

  @override
  Future<PesapalStatus> queryPesapal(String orderTrackingId) async =>
      pesapalStatus ??
      PesapalStatus(
        orderTrackingId: orderTrackingId,
        status: 'pending',
        paid: false,
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late _FakeRepo repo;
  late ProviderContainer container;

  setUp(() {
    repo = _FakeRepo();
    container = ProviderContainer(
      overrides: [paymentsRepositoryProvider.overrideWithValue(repo)],
    );
  });

  tearDown(() => container.dispose());

  PaymentAttempt read() => container.read(paymentControllerProvider);
  PaymentController ctrl() =>
      container.read(paymentControllerProvider.notifier);

  group('switching rails mid-initiation', () {
    test(
      'a slow STK response does not overwrite a newer card attempt',
      () async {
        // The regression: startMpesa wrote its result after the await without
        // re-checking whether it had been superseded, so the losing rail's
        // response landed on top of the live one. Both rails then had live
        // server-side attempts while the UI tracked only the stale one.
        repo.stkGate = Completer<MpesaPush>();

        final Future<void> mpesa = ctrl().startMpesa(
          orderId: 'order-1',
          phone: '0712345678',
        );
        await Future<void>.delayed(Duration.zero); // reach the await
        expect(read().method, PaymentMethodOption.mpesa);

        // Customer changes their mind while the prompt is still being sent.
        await ctrl().startPesapal('order-1');
        expect(read().method, PaymentMethodOption.pesapal);

        // The abandoned STK call now comes back.
        repo.stkGate!.complete(
          const MpesaPush(checkoutRequestId: 'CR-1', message: 'Prompt sent'),
        );
        await mpesa;

        expect(
          read().method,
          PaymentMethodOption.pesapal,
          reason: 'the superseded M-Pesa initiation must not reclaim the state',
        );
        expect(read().orderTrackingId, 'OT-1');
        expect(
          read().checkoutRequestId,
          isNull,
          reason:
              'a stale checkoutRequestId would make _alreadyPaid query the '
              'wrong attempt on the next retry',
        );
      },
    );

    test('a slow Pesapal response does not overwrite a newer STK attempt', () async {
      repo.pesapalGate = Completer<PesapalInitiation>();
      // The winning STK attempt runs its poll loop to completion; without a
      // resolving status it would sit in the 90s window and time the test out.
      repo.mpesaStatus = MpesaStatus(
        checkoutRequestId: 'CR-1',
        status: 'matched',
        paid: true,
        resultDesc: 'Payment received.',
      );

      final Future<String?> pesapal = ctrl().startPesapal('order-1');
      await Future<void>.delayed(Duration.zero);
      expect(read().method, PaymentMethodOption.pesapal);

      await ctrl().startMpesa(orderId: 'order-1', phone: '0712345678');
      expect(read().method, PaymentMethodOption.mpesa);

      repo.pesapalGate!.complete(
        const PesapalInitiation(
          orderTrackingId: 'OT-1',
          redirectUrl: 'https://pay.example/checkout',
          message: 'Opening Pesapal',
        ),
      );
      final String? url = await pesapal;

      expect(
        url,
        isNull,
        reason: 'a superseded initiation must not hand back a URL to open',
      );
      expect(read().method, PaymentMethodOption.mpesa);
    });
  });

  group('reset', () {
    test('clears provider ids so a new order cannot inherit them', () async {
      await ctrl().startPesapal('order-1');
      expect(read().orderTrackingId, 'OT-1');

      ctrl().reset();

      // The danger this guards: _alreadyPaid queries whatever ids are in
      // state. Carried into a second order, a previous order's paid id would
      // mark the new, unpaid one as successful.
      expect(read().orderTrackingId, isNull);
      expect(read().checkoutRequestId, isNull);
      expect(read().phase, PaymentPhase.idle);
    });
  });
}
