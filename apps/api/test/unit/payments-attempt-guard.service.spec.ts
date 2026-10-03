import { ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { MpesaPushOutcomeUnknownException } from '../../src/modules/payments/mpesa.service';
import { ATTEMPT_WAIT_MS } from '../../src/modules/payments/payments.constants';

/**
 * `PaymentsService`'s side of the concurrent-attempt guard (SPEC-11 B-7): what it
 * does with each answer `claim_payment_attempt` can give, and — the part a real
 * database makes awkward to pin down — WHEN it releases the claim.
 *
 * The database half is `payment-attempt-guard.e2e-spec.ts`. This file fakes it,
 * so that the ordering of calls, the failure postures and the wait loop can be
 * asserted deterministically and without a stack.
 */

const ORDER_ID = 'order-1';
const PHONE = '254712345678';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

interface Harness {
  service: PaymentsService;
  /** Ordered record of what touched the database and the provider. */
  log: string[];
  mpesa: { stkPush: jest.Mock };
  pesapal: { submitOrder: jest.Mock };
  rpc: jest.Mock;
  setInsertError(error: { code?: string; message: string } | null): void;
}

const WON: RpcResult = { data: { claimed: true }, error: null };
const IN_FLIGHT: RpcResult = {
  data: { claimed: false, reason: 'in_flight', retry_after_seconds: 40 },
  error: null,
};

function harness(claim: (call: number) => RpcResult): Harness {
  const log: string[] = [];
  let insertError: { code?: string; message: string } | null = null;
  let claimCalls = 0;

  const rpc = jest.fn(async (name: string): Promise<RpcResult> => {
    if (name === 'claim_payment_attempt') {
      claimCalls += 1;
      log.push('claim');
      return claim(claimCalls);
    }
    log.push('release');
    return { data: null, error: null };
  });

  const customer = {
    id: 'cust-1',
    email: 'c@example.com',
    full_name: 'Test Customer',
    phone: PHONE,
  };
  const order = {
    id: ORDER_ID,
    order_number: 'ORD-1',
    customer_id: 'cust-1',
    total_kes: 1000,
    status: 'pending_payment',
    payment_status: 'pending',
    payment_method: 'mpesa',
  };

  const from = (table: string) => {
    let op: 'select' | 'insert' | 'update' = 'select';
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.neq = chain;
    b.update = () => {
      op = 'update';
      return b;
    };
    b.insert = () => {
      op = 'insert';
      log.push(`insert:${table}`);
      return b;
    };
    b.maybeSingle = async () => ({ data: table === 'customers' ? customer : order, error: null });
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(
        op === 'insert'
          ? { error: insertError }
          : op === 'update'
            ? { error: null }
            : { data: [], error: null },
      ).then(resolve, reject);
    return b;
  };

  const mpesa = {
    stkPush: jest.fn(async () => {
      log.push('push');
      return {
        MerchantRequestID: 'mr-1',
        CheckoutRequestID: 'ws_CO_1',
        ResponseCode: '0',
        ResponseDescription: 'ok',
        CustomerMessage: 'sent',
      };
    }),
  };
  const pesapal = {
    submitOrder: jest.fn(async () => {
      log.push('submit');
      return {
        order_tracking_id: 'pp-1',
        merchant_reference: 'ORD-1',
        redirect_url: 'https://pay.example/1',
        status: '200',
      };
    }),
  };

  const service = new PaymentsService(
    { client: { from, rpc } } as never,
    mpesa as never,
    pesapal as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return {
    service,
    log,
    mpesa,
    pesapal,
    rpc,
    setInsertError: (e) => {
      insertError = e;
    },
  };
}

const push = (h: Harness) => h.service.initiateMpesaStkPush('auth-1', ORDER_ID, PHONE);
const card = (h: Harness) => h.service.initiatePesapal('auth-1', ORDER_ID);

describe('PaymentsService concurrent-attempt guard', () => {
  beforeEach(() => {
    // Every failure path logs at error; keep the run readable.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('M-Pesa: when the claim is released', () => {
    it('claims, pushes, records, and only THEN releases', async () => {
      const h = harness(() => WON);
      const result = await push(h);

      expect(result.checkoutRequestId).toBe('ws_CO_1');
      // The claim query in migration 0042 relies on the row being visible by the
      // time the claim is gone. Releasing first would reopen the race.
      expect(h.log).toEqual(['claim', 'push', 'insert:mpesa_transactions', 'release']);
    });

    it('still releases when Daraja replays an id we already hold (unique violation)', async () => {
      const h = harness(() => WON);
      h.setInsertError({ code: '23505', message: 'duplicate key' });
      await expect(push(h)).resolves.toMatchObject({ checkoutRequestId: 'ws_CO_1' });
      expect(h.log.at(-1)).toBe('release');
    });

    it('releases immediately when Daraja plainly refuses — nothing reached a handset', async () => {
      const h = harness(() => WON);
      h.mpesa.stkPush.mockRejectedValueOnce(new ServiceUnavailableException('rejected'));

      await expect(push(h)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(h.log).toEqual(['claim', 'release']);
    });

    it('does NOT release when the outcome is unknown — a prompt may be on the handset', async () => {
      const h = harness(() => WON);
      h.mpesa.stkPush.mockRejectedValueOnce(new MpesaPushOutcomeUnknownException());

      await expect(push(h)).rejects.toBeInstanceOf(MpesaPushOutcomeUnknownException);
      // Releasing here would let the customer ask again while the first prompt
      // is still answerable.
      expect(h.log).toEqual(['claim']);
    });

    it('does NOT release when the prompt went out but could not be recorded', async () => {
      const h = harness(() => WON);
      h.setInsertError({ code: 'XX000', message: 'disk full' });

      await expect(push(h)).rejects.toThrow('Could not record the payment attempt.');
      expect(h.log).toEqual(['claim', 'push', 'insert:mpesa_transactions']);
    });
  });

  describe('M-Pesa: reading the claim', () => {
    it('fails OPEN, loudly, when the function is missing (deploy ran ahead of the migration)', async () => {
      const h = harness(() => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function' },
      }));

      await expect(push(h)).resolves.toMatchObject({ checkoutRequestId: 'ws_CO_1' });
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('migration 0042 has not been applied'),
      );
    });

    it('fails CLOSED on any other database error — nothing is sent', async () => {
      const h = harness(() => ({ data: null, error: { code: '57014', message: 'timeout' } }));

      await expect(push(h)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
    });

    it('fails CLOSED on a payload it does not recognise — never reads it as "claimed"', async () => {
      const h = harness(() => ({ data: { claimed: 'yes' }, error: null }));

      await expect(push(h)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
    });

    it('answers a repeat request to the same number with the live prompt, sending nothing', async () => {
      const h = harness(() => ({
        data: {
          claimed: false,
          reason: 'live_attempt',
          provider: 'mpesa',
          ref: 'ws_CO_LIVE',
          phone: PHONE,
          raw: { CheckoutRequestID: 'ws_CO_LIVE', MerchantRequestID: 'mr-live' },
          retry_after_seconds: 30,
        },
        error: null,
      }));

      await expect(push(h)).resolves.toMatchObject({
        checkoutRequestId: 'ws_CO_LIVE',
        merchantRequestId: 'mr-live',
      });
      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
      // Nothing was claimed, so there is nothing to release.
      expect(h.log).toEqual(['claim']);
    });

    it('refuses a live card session with a 409 and sends nothing', async () => {
      const h = harness(() => ({
        data: {
          claimed: false,
          reason: 'live_attempt',
          provider: 'pesapal',
          ref: 'pp-live',
          phone: null,
          raw: { redirect_url: 'https://pay.example/live' },
          retry_after_seconds: 30,
        },
        error: null,
      }));

      await expect(push(h)).rejects.toBeInstanceOf(ConflictException);
      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
    });
  });

  describe('M-Pesa: waiting for a request that is still talking to Daraja', () => {
    it('polls, and turns into a replay once the first request has recorded its prompt', async () => {
      jest.useFakeTimers();
      const h = harness((call) =>
        call < 3
          ? IN_FLIGHT
          : {
              data: {
                claimed: false,
                reason: 'live_attempt',
                provider: 'mpesa',
                ref: 'ws_CO_FIRST',
                phone: PHONE,
                raw: { CheckoutRequestID: 'ws_CO_FIRST' },
                retry_after_seconds: 80,
              },
              error: null,
            },
      );

      const pending = push(h);
      await jest.advanceTimersByTimeAsync(5_000);

      // Both callers end up holding the same id — a double tap, or a retry after
      // the app's own timeout, is idempotent rather than an error.
      await expect(pending).resolves.toMatchObject({ checkoutRequestId: 'ws_CO_FIRST' });
      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
    });

    it('takes over the claim if the first request failed cleanly and released it', async () => {
      jest.useFakeTimers();
      const h = harness((call) => (call < 2 ? IN_FLIGHT : WON));

      const pending = push(h);
      await jest.advanceTimersByTimeAsync(5_000);

      await expect(pending).resolves.toMatchObject({ checkoutRequestId: 'ws_CO_1' });
      expect(h.mpesa.stkPush).toHaveBeenCalledTimes(1);
    });

    it('gives up with a 409 after ATTEMPT_WAIT_MS, having sent nothing', async () => {
      jest.useFakeTimers();
      const h = harness(() => IN_FLIGHT);

      const pending = push(h);
      // Attach the rejection handler before advancing time, or the rejection is
      // reported as unhandled while the clock moves.
      const settled = expect(pending).rejects.toBeInstanceOf(ConflictException);
      await jest.advanceTimersByTimeAsync(ATTEMPT_WAIT_MS + 1_000);
      await settled;

      expect(h.mpesa.stkPush).not.toHaveBeenCalled();
      // Bounded polling: more than once, far fewer than a tight loop.
      const polls = h.log.filter((e) => e === 'claim').length;
      expect(polls).toBeGreaterThan(3);
      expect(polls).toBeLessThan(30);
    });
  });

  describe('Pesapal', () => {
    it('claims, submits, records, and only THEN releases', async () => {
      const h = harness(() => WON);
      const result = await card(h);

      expect(result.redirectUrl).toBe('https://pay.example/1');
      expect(h.log).toEqual(['claim', 'submit', 'insert:pesapal_transactions', 'release']);
    });

    it('releases when the submit fails — a session nobody was given a URL for cannot be paid', async () => {
      const h = harness(() => WON);
      h.pesapal.submitOrder.mockRejectedValueOnce(new ServiceUnavailableException('down'));

      await expect(card(h)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(h.log).toEqual(['claim', 'release']);
    });

    it('releases when the session could not be recorded either', async () => {
      const h = harness(() => WON);
      h.setInsertError({ code: 'XX000', message: 'disk full' });

      await expect(card(h)).rejects.toThrow('Could not record the payment attempt.');
      expect(h.log.at(-1)).toBe('release');
    });

    it('answers a repeat request with the open session, opening no second one', async () => {
      const h = harness(() => ({
        data: {
          claimed: false,
          reason: 'live_attempt',
          provider: 'pesapal',
          ref: 'pp-open',
          phone: null,
          raw: { redirect_url: 'https://pay.example/open' },
          retry_after_seconds: 60,
        },
        error: null,
      }));

      await expect(card(h)).resolves.toMatchObject({
        orderTrackingId: 'pp-open',
        redirectUrl: 'https://pay.example/open',
      });
      expect(h.pesapal.submitOrder).not.toHaveBeenCalled();
    });

    it('refuses while an M-Pesa prompt is live', async () => {
      const h = harness(() => ({
        data: {
          claimed: false,
          reason: 'live_attempt',
          provider: 'mpesa',
          ref: 'ws_CO_LIVE',
          phone: PHONE,
          raw: {},
          retry_after_seconds: 60,
        },
        error: null,
      }));

      await expect(card(h)).rejects.toBeInstanceOf(ConflictException);
      expect(h.pesapal.submitOrder).not.toHaveBeenCalled();
    });
  });
});
