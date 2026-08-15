/**
 * Jest setup for the e2e suite.
 *
 * The credential endpoints are rate-limited to 10/min per address (F-01), and
 * the suite runs `--runInBand` in ONE process — so every spec file shares the
 * throttler's in-memory store and every signup counts against the same
 * 127.0.0.1 bucket. Four suites in, the later ones start getting 429s on
 * signup: the limiter working exactly as intended, against a client that is not
 * what it is meant to stop.
 *
 * Raising the ceiling here keeps production strict while letting the suite
 * exercise what it is actually for. The limiter itself is covered separately in
 * `throttling.e2e-spec.ts`, which sets its own value.
 */
process.env.AUTH_RATE_LIMIT = process.env.AUTH_RATE_LIMIT ?? '10000';

/**
 * Reuse TCP connections across supertest requests.
 *
 * Superagent opens a fresh socket per request and closes it, and macOS parks
 * each one in TIME_WAIT for two minutes. Fourteen suites in one `--runInBand`
 * process put ~600 sockets in that state, at which point requests start failing
 * with "socket hang up" — and because it is a shared resource, the failure lands
 * on whichever suite happens to be running, not on the one that spent the
 * sockets. That made it look like flakiness in cart, reviews, appointments and
 * wishlist by turns.
 *
 * Superagent falls back to `http.globalAgent` when given no agent of its own,
 * so enabling keep-alive here fixes every suite at once rather than each having
 * to manage its own agent.
 */
import http from 'node:http';
import https from 'node:https';

// Replaced rather than mutated: `keepAlive` is a constructor option, not a
// writable property on the Agent type.
http.globalAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
https.globalAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
