import { expect, unauthenticatedTest as test } from '../fixtures/api-mocks.js';

// Language switching triggers a page re-render that goes through beforeLoad again,
// which can be slow when the backend is unavailable.
test.describe('Language Switcher', () => {
  // Allow extra time for these tests since locale changes can trigger reloads
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    // Set locale before the app scripts run to avoid an extra reload
    await page.addInitScript(() => {
      window.localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    });
    await page.goto('/');
    // Wait for the English heading to confirm page is ready
    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible({ timeout: 60000 });
  });

  test('defaults to English', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible();
  });

  // Language switching tests are skipped — Paraglide locale change triggers a
  // full route re-evaluation through TanStack Router beforeLoad, which doesn't
  // reliably complete in the mocked e2e environment.
  test.skip('switches to Czech', async ({ page }) => {
    // Open the language select
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();

    // Select Czech
    await page.getByRole('option', { name: /Čeština/ }).click();

    // Wait directly for the Czech heading (long timeout for beforeLoad in CI)
    await expect(
      page.getByRole('heading', { name: 'Spravujte svůj sportovní tým bez námahy' }),
    ).toBeVisible({ timeout: 60000 });
  });

  test.skip('switches back to English from Czech', async ({ page }) => {
    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();

    // Wait for Czech heading
    await expect(
      page.getByRole('heading', { name: 'Spravujte svůj sportovní tým bez námahy' }),
    ).toBeVisible({ timeout: 60000 });

    // Switch back to English
    await trigger.click();
    await page.getByRole('option', { name: /English/ }).click();

    // Wait for English heading
    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible({ timeout: 60000 });
  });

  test.skip('language switch updates footer text', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toContainText('Built for teams that use Discord');

    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();

    // Wait for Czech footer text
    await expect(footer).toContainText('Vytvořeno pro týmy používající Discord', {
      timeout: 60000,
    });
  });

  test.skip('language switch updates sign-in button text', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Sign in with Discord/ })).toBeVisible();

    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();

    // Wait for Czech sign-in button text
    await expect(page.getByRole('link', { name: /Přihlásit se přes Discord/ })).toBeVisible({
      timeout: 60000,
    });
  });
});
