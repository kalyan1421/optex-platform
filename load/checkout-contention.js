import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

/**
 * CHECKOUT CONTENTION — the scenario that would have caught audit F-02.
 *
 * Many shoppers race to buy the last units of ONE product at the same instant.
 * Before migration 0020 every one of them succeeded, because `place_order`
 * computed money impeccably and never looked at `inventory` — the shop sold
 * frames it did not have, on a platform where cancelling a paid order requires
 * an explicit admin acknowledgement.
 *
 * This is also the shape of test the whole suite was missing. 163 functional
 * tests pass at concurrency one; overselling only exists at concurrency > 1.
 *
 * THE ASSERTION IS CONSERVATION, NOT SUCCESS. We do not care how many orders
 * succeed — that depends on the stock the operator set. We care that
 * `successes <= starting stock`. One sale above that is an oversell.
 *
 * SETUP REQUIRED — this scenario writes real orders, so it needs a real account
 * and a target product:
 *
 *   k6 run \
 *     -e EMAIL=loadtest@example.com \
 *     -e PASSWORD='...' \
 *     -e PRODUCT_ID=<uuid> \
 *     -e STOCK=25 \
 *     load/checkout-contention.js
 *
 * Point it at a THROWAWAY product on a throwaway environment. It will drain
 * that product's stock and leave orders behind, which is the point.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:1112';
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;
const PRODUCT_ID = __ENV.PRODUCT_ID;
/** Units the product started with — the ceiling successes must not exceed. */
const STOCK = Number(__ENV.STOCK || 25);

const ordersPlaced = new Counter('orders_placed');
const outOfStock = new Counter('rejected_out_of_stock');
const unexpected = new Counter('unexpected_failures');

export const options = {
  scenarios: {
    // All at once, deliberately. A ramp would let stock deplete gradually and
    // never produce the simultaneous read-then-write that overselling needs.
    stampede: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 50,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // THE CONSERVATION CHECK. More successful orders than units in stock means
    // the lock in `place_order` failed and F-02 has regressed.
    orders_placed: [`count<=${STOCK}`],
    // A 409 is the correct answer once stock runs out — it is not an error.
    // Anything that is neither a sale nor an out-of-stock rejection is.
    unexpected_failures: ['count==0'],
  },
};

export function setup() {
  if (!EMAIL || !PASSWORD || !PRODUCT_ID) {
    throw new Error(
      'checkout-contention needs EMAIL, PASSWORD and PRODUCT_ID. See the header comment.',
    );
  }

  // One login, shared by every VU. Fifty simultaneous logins would just hit the
  // credential rate limit (10/min) and test that instead.
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed (${res.status}): ${res.body}`);
  }

  const token = res.json('session.access_token') ?? res.json('access_token');
  if (!token) throw new Error('Login succeeded but returned no access token.');

  return { token };
}

export default function (data) {
  const auth = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
  };

  // Every VU shares one account and therefore one cart, which is exactly the
  // contention we want on the cart rows as well as on inventory.
  const add = http.post(
    `${BASE_URL}/api/cart/items`,
    JSON.stringify({ productId: PRODUCT_ID, quantity: 1 }),
    auth,
  );
  check(add, { 'cart add accepted': (r) => r.status === 200 || r.status === 201 });

  const res = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      paymentMethod: 'mpesa',
      deliveryOption: 'delivery',
      shippingAddress: {
        name: `Load Test ${exec.vu.idInTest}`,
        phone: '0712345678',
        address: '1 Load Test Road',
        city: 'Nairobi',
        county: 'Nairobi',
      },
    }),
    auth,
  );

  if (res.status === 200 || res.status === 201) {
    ordersPlaced.add(1);
  } else if (res.status === 409) {
    // The expected answer once the shelf is empty — and the behaviour F-02 added.
    outOfStock.add(1);
  } else if (res.status === 400 && String(res.body).includes('empty')) {
    // Another VU drained the shared cart between our add and our checkout.
    // A race on the fixture, not on the thing under test.
    outOfStock.add(1);
  } else {
    unexpected.add(1);
    console.error(`unexpected checkout response ${res.status}: ${res.body}`);
  }
}

export function teardown() {
  console.log(
    `Started with ${STOCK} units. Anything above that in orders_placed is an oversell — see F-02.`,
  );
}
