import { test, expect, Page } from '@playwright/test';

/**
 * Full appointment booking flow — audit finding F-17.
 *
 * `appointments-gate.spec.ts` covered the signed-out redirect and stopped
 * there — nothing walked a signed-in customer through the actual three-step
 * wizard (branch → type/date/time → contact details) to a confirmed booking.
 * That flow has real server-side logic behind it: the API resolves available
 * slots from the branch's opening hours and existing bookings, and a
 * `pg_advisory_xact_lock`-guarded trigger enforces per-slot capacity — none of
 * which a component test or the gate test alone exercises.
 */

function throwawayEmail(): string {
  return `appt-e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@optex-test.local`;
}

async function signUpFreshAccount(page: Page): Promise<void> {
  const email = throwawayEmail();
  await page.goto('/signup');
  await page.getByPlaceholder('John Doe').fill('Appointments E2E Tester');
  await page.getByPlaceholder('john@example.com').fill(email);
  const passwords = page.getByPlaceholder('••••••••');
  await passwords.nth(0).fill('TestPassword123!');
  await passwords.nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('**/profile', { timeout: 20_000 });
}

/**
 * Fills the date input day by day, starting tomorrow, until the time <select>
 * offers a real slot, then picks the first one.
 *
 * Branch opening hours vary by weekday and a slot can already be fully
 * booked, so no single fixed date is safe to hardcode — the API is the
 * source of truth for what's actually bookable, exactly as the app itself
 * treats it. Fourteen days comfortably covers a closed Sunday or two without
 * masking a genuine "nothing is ever available" regression.
 */
async function selectFirstAvailableSlot(page: Page): Promise<void> {
  const dateInput = page.locator('input[type="date"]');
  const timeSelect = page.locator('select');

  for (let daysAhead = 1; daysAhead <= 14; daysAhead++) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const iso = d.toISOString().slice(0, 10);

    await dateInput.fill(iso);
    // The slot lookup is a real network round trip; wait for the select to
    // leave its "Loading available times…" placeholder rather than racing it.
    await expect(timeSelect.locator('option', { hasText: /loading/i })).toHaveCount(0, {
      timeout: 10_000,
    });

    const values = await timeSelect
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value).filter(Boolean));

    if (values.length > 0) {
      await timeSelect.selectOption(values[0]);
      return;
    }
  }

  throw new Error(
    'No bookable slot found in the next 14 days across any date — either every branch is fully booked and closed for two weeks straight, or slot lookup is broken.',
  );
}

test('a signed-in customer books an appointment end to end', async ({ page }) => {
  await signUpFreshAccount(page);
  await page.goto('/appointments');

  // ── Step 1: branch ──
  await expect(page.getByText(/book an appointment/i).first()).toBeVisible();
  // The branch cards are plain buttons with no accessible name beyond their
  // content, so the first one is the reliable target; which branch the seed
  // produced doesn't matter to this test. Scoped to <main> — the floating
  // CompareTray widget (a sibling, not a descendant — see MainLayout.jsx) can
  // leave its own buttons on the page from earlier browsing in the same
  // storage state, and `getByRole('button')` unscoped would happily match those.
  await page.locator('main').getByRole('button').first().click();

  // ── Step 2: type (leave the pre-selected default), date + time ──
  await expect(page.getByText('Appointment Type', { exact: true })).toBeVisible();
  await selectFirstAvailableSlot(page);
  await page.getByRole('button', { name: /continue to your details/i }).click();

  // ── Step 3: contact details ──
  await expect(page.getByText(/contact name/i)).toBeVisible();
  // Step 3 is the only mounted step at this point (conditional rendering, not
  // just hidden), so these are the only text/tel inputs on the page.
  const nameField = page.locator('input[type="text"]');
  const phoneField = page.locator('input[type="tel"]');
  // Full name is pre-filled from the profile created at signup; phone is not
  // (signup never asks for one), so it always needs filling. Overwrite both
  // explicitly rather than relying on the pre-fill, so this test does not
  // depend on that separate best-effort behaviour succeeding.
  await nameField.fill('Appointments E2E Tester');
  await phoneField.fill('0712345678');

  await page.getByRole('button', { name: /^book appointment$/i }).click();

  // ── Confirmation ──
  await expect(page.getByText(/appointment requested/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/we'll confirm via sms/i)).toBeVisible();
});

test('cannot continue past step 2 without picking a date and time', async ({ page }) => {
  await signUpFreshAccount(page);
  await page.goto('/appointments');

  await page.locator('main').getByRole('button').first().click();
  await expect(page.getByText('Appointment Type', { exact: true })).toBeVisible();

  // Nothing picked yet — the wizard must refuse to advance rather than
  // letting a booking reach the server with no requested time.
  await expect(page.getByRole('button', { name: /continue to your details/i })).toBeDisabled();
});
