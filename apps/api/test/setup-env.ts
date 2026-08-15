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
