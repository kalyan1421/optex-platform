/**
 * Unit tests for the shared UI package (audit F-08).
 *
 * All five workspace packages had zero tests. `formatKes` renders every price a
 * customer sees on both the storefront and the admin panel, and its null-safety
 * is described in CLAUDE.md as a feature — which makes it exactly the kind of
 * behaviour worth pinning rather than assuming.
 *
 * No jsdom: these are pure functions, and a DOM would only slow the run down.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
