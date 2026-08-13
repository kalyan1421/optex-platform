import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Admin panel e2e suite.
 *
 * Tier 3 of docs/TEST-PLAN.md — this app had zero test infrastructure before
 * this file. Every route except `/login` is gated by `middleware.ts` on
 * `app_metadata.role === 'super_admin'`, checked via a real Supabase SSR
 * cookie session — not a bearer token — so an authenticated run needs an
 * actual browser login, not a hand-minted header. `global-setup.ts` creates a
 * throwaway admin account, logs in through the real `/login` form once, and
 * saves the resulting cookie session; every test in this suite starts already
 * authenticated via `storageState`.
 *
 * Mirrors apps/web/playwright.config.ts's shape and reasoning (production
 * build, not `next dev` — per-route dev compilation is exactly the kind of
 * flakiness a smoke suite should not have to work around).
 *
 * Assumes the API (:1111) and the Supabase stack are already up.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:1113',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: path.join(__dirname, 'e2e/.auth/admin.json'),
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:1113',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
