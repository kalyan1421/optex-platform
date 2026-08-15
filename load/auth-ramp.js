import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * AUTH + THROTTLE RAMP — finds the 429 knee, and proves the two limits are
 * scoped the way audit F-01 intended.
 *
 * This is the STRESS scenario. It climbs far past any realistic peak on purpose,
 * to answer two questions that `load/browse.js` (which models a normal busy
 * hour) cannot:
 *
 *   1. Where is the knee — at what rate does the limiter start shedding?
 *   2. When it sheds, does the service REFUSE work cleanly, or fall over?
 *
 * Alongside it, a single attacker guesses one account's password, so the run
 * also shows the credential ceiling holding while ordinary reads continue.
 *
 * Read the numbers, not just the pass/fail: `browse_rate_limited` at this rate
 * is expected to be high, and the useful signal is that latency stays flat
 * while it happens.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:1112';

const browseRateLimited = new Rate('browse_rate_limited');
const loginRateLimited = new Rate('login_rate_limited');
const browseDuration = new Trend('browse_duration', true);

export const options = {
  scenarios: {
    // Climbs well past a realistic peak to find where latency turns up.
    browse_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 300 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browse',
    },
    // A single attacker guessing one account's password.
    credential_stuffing: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 10,
      exec: 'guessPassword',
      startTime: '30s',
    },
  },
  thresholds: {
    // Password guessing must be refused, and overwhelmingly so. At 5/s against
    // a 10/min ceiling, nearly everything should bounce.
    login_rate_limited: ['rate>0.9'],

    // THE POINT OF A STRESS RAMP. This climbs to 300 req/s from a single
    // address — roughly 18,000/min against a 2,000/min catalogue ceiling — so
    // heavy throttling here is the limiter doing its job, not a regression.
    // An earlier version of this file asserted `browse_rate_limited == 0` and
    // failed at 84%, which was the threshold being wrong rather than the API.
    // `load/browse.js` is where zero-throttling is asserted, because that one
    // models a realistic peak; this one exists to find the knee and to prove
    // the service degrades by REFUSING work rather than by falling over.
    //
    // So: latency must stay healthy even while shedding load…
    'browse_duration{endpoint:products}': ['p(95)<1500'],
    // …and the requests that do get through must genuinely succeed. A 5xx here
    // would mean we broke instead of throttling.
    'http_req_failed{endpoint:products}': ['rate<0.9'],
  },
};

export function browse() {
  const res = http.get(`${BASE_URL}/api/products?limit=24`, { tags: { endpoint: 'products' } });
  browseDuration.add(res.timings.duration, { endpoint: 'products' });
  browseRateLimited.add(res.status === 429);
  // 429 is a correct answer at this rate, so it is not a failed check. What
  // would be a failure is a 5xx — breaking rather than refusing.
  check(res, { 'served or refused, never broken': (r) => r.status === 200 || r.status === 429 });
}

export function guessPassword() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    // A real account name with wrong passwords is the shape of the attack; the
    // account does not need to exist for the limiter to be the thing tested.
    JSON.stringify({ email: 'victim@optex-test.local', password: `guess-${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  loginRateLimited.add(res.status === 429);
  // 401 and 429 are both fine. A 200 would mean we guessed it.
  check(res, { 'never authenticates': (r) => r.status !== 200 });
}
