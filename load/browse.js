import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * BROWSE LOAD — the traffic 95% of visitors actually generate.
 *
 * Home → shop → PDP → search, with think time between steps. This is the path
 * most exposed to audit F-01: before the fix every one of these requests keyed
 * on the proxy's address, so a handful of concurrent shoppers 429'd each other.
 * `rate_limited` below exists to make that visible rather than letting it hide
 * inside a general error count.
 *
 * Goes through the storefront (:1112) rather than the API, because that is the
 * path a real customer takes — see load/README.md.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:1112';

/** 429s specifically — a rate-limit failure is a different problem to a 500. */
const rateLimited = new Rate('rate_limited');
/** Server-rendered page latency, kept apart from the JSON endpoints. */
const pageDuration = new Trend('page_duration', true);

export const options = {
  scenarios: {
    // Ramp to a plausible busy hour for a Kenyan optician with a few branches,
    // hold, then ramp down. Not a stress test — this is "a good day".
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Catalogue pages are cached Server Components; a second is generous.
    'page_duration{page:shop}': ['p(95)<1000'],
    'page_duration{page:pdp}': ['p(95)<1200'],
    http_req_failed: ['rate<0.01'],
    // THE F-01 ASSERTION. Any 429 during ordinary browsing means the limiter is
    // catching real customers, which is the bug the finding was about. Zero
    // tolerance is correct here: legitimate browsing must never be throttled.
    rate_limited: ['rate==0'],
  },
};

/** Records a response against a page label and flags rate limiting. */
function track(res, page) {
  pageDuration.add(res.timings.duration, { page });
  rateLimited.add(res.status === 429);
  check(res, {
    [`${page}: 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${page}: not rate limited`]: (r) => r.status !== 429,
  });
  return res;
}

export default function () {
  group('home', () => {
    track(http.get(`${BASE_URL}/`, { tags: { page: 'home' } }), 'home');
    // Real people read before clicking. Without think time this measures a
    // hammering bot, not a busy hour.
    sleep(Math.random() * 3 + 1);
  });

  group('shop', () => {
    track(http.get(`${BASE_URL}/shop`, { tags: { page: 'shop' } }), 'shop');
    sleep(Math.random() * 4 + 2);
  });

  group('pdp', () => {
    // Pull a real slug from the catalogue rather than hardcoding one, so the
    // scenario survives a reseed.
    const list = http.get(`${BASE_URL}/api/products?limit=12`, { tags: { page: 'api_products' } });
    rateLimited.add(list.status === 429);

    let slug = null;
    try {
      const items = list.json('items');
      if (Array.isArray(items) && items.length > 0) {
        slug = items[Math.floor(Math.random() * items.length)].slug;
      }
    } catch {
      // A malformed body is a failure the checks above already record.
    }

    if (slug) {
      track(http.get(`${BASE_URL}/product/${slug}`, { tags: { page: 'pdp' } }), 'pdp');
      sleep(Math.random() * 5 + 2);
    }
  });

  group('search', () => {
    // Vary the term so the API's full-text path is exercised rather than one
    // response being served from cache for the whole run.
    const terms = ['aviator', 'round', 'metal', 'sunglasses', 'reading', 'titanium'];
    const q = terms[Math.floor(Math.random() * terms.length)];
    track(
      http.get(`${BASE_URL}/search?q=${encodeURIComponent(q)}`, { tags: { page: 'search' } }),
      'search',
    );
    sleep(Math.random() * 3 + 1);
  });
}
