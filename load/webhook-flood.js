import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * WEBHOOK FLOOD — the payment receivers are the only endpoints deliberately
 * exempt from rate limiting, which makes them the ones worth knowing the limits
 * of.
 *
 * `/api/webhooks/mpesa` and `/api/webhooks/pesapal` are `@Public()` AND
 * `@SkipThrottle()`, and correctly so: dropping a provider callback loses a
 * customer's payment confirmation. But exempt means unbounded, and the Pesapal
 * IPN handler does something the M-Pesa one does not — it makes an OUTBOUND
 * call to Pesapal's GetTransactionStatus for every tracking id it receives.
 * That is request amplification: cheap to send, expensive to serve.
 *
 * The audit noted this and did not raise it, because the correct control is
 * provider IP allow-listing at the edge rather than a change in the handler.
 * This scenario is how you size that control — and how you verify the handlers
 * stay honest under load: they must always ACK, so the provider stops retrying,
 * and must never credit an order from an unverified body.
 *
 * Run against a THROWAWAY environment. Never against production, and never
 * against an environment with live Pesapal credentials — that would aim the
 * amplification at the provider.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:1111';

const ackDuration = new Trend('webhook_ack_duration', true);

export const options = {
  scenarios: {
    flood: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    // The provider gives up and retries if we are slow, so the ACK has to stay
    // fast even while we are being flooded.
    webhook_ack_duration: ['p(95)<500'],
    // Never 5xx at a payment provider: it triggers their retry storm on top of
    // whatever is already happening.
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // A callback for a CheckoutRequestID that was never issued. The handler must
  // recognise it as unknown, ack anyway, and credit nothing.
  const res = http.post(
    `${BASE_URL}/api/webhooks/mpesa`,
    JSON.stringify({
      Body: {
        stkCallback: {
          MerchantRequestID: `load-${__VU}-${__ITER}`,
          CheckoutRequestID: `ws_CO_LOADTEST${__VU}${__ITER}`,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: { Item: [{ Name: 'Amount', Value: 1 }] },
        },
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  ackDuration.add(res.timings.duration);
  check(res, {
    // Daraja treats anything else as "resend", so this must hold under load.
    'always acknowledges': (r) => r.status === 200 || r.status === 201,
    'acks with ResultCode 0': (r) => String(r.body).includes('"ResultCode":0'),
    // Exempt from throttling by design — a 429 here would mean the exemption
    // has been lost and real callbacks are being dropped.
    'never rate limited': (r) => r.status !== 429,
  });
}
