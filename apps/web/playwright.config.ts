import { defineConfig, devices } from '@playwright/test';

/**
 * Storefront smoke suite.
 *
 * Wave 0 called for this before any migration and it never happened; Waves 1-2
 * shipped without it. It is the stated hard prerequisite for Wave 4, which
 * converts /shop and /product/[slug] to Server Components — a rewrite of the
 * rendering model for the pages that carry the revenue. Without a suite that
 * walks the purchase path, that rewrite has nothing holding it honest.
 *
 * Deliberately thin. It asserts the journey still works, not how any page
 * looks, so it survives the redesign it exists to protect.
 *
 * Assumes the API (:1111) and the Supabase stack are already up — locally via
 * `pnpm dev:api` + `docker compose up -d supabase-kong`, in CI via the e2e job.
 * Playwright starts the web server itself.
 */
export default defineConfig({
  testDir: './e2e',
  // The journey steps depend on each other, so a file runs start to finish.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:1112',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Runs against a production build, not `next dev`.
  //
  // Two reasons. The dev server compiles each route on first request, which
  // made this suite flaky — a cold /shop, /product/[slug], /cart or /checkout
  // could exceed the per-test timeout, and which test paid the cost moved
  // between runs. And the suite exists to protect the Wave 4 render-mode
  // rewrite, so it should exercise the rendering the customer actually gets.
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:1112',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
