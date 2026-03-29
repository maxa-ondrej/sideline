import { expect, test } from '@playwright/test';

// Language switching triggers a page re-render that goes through beforeLoad again,
// which can be slow when the backend is unavailable.
test.describe('Language Switcher', () => {
  // Allow extra time for these tests since locale changes can trigger reloads
  test.setTimeout(120000);

  async function waitForPageReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 60000,
    });
  }

  test.beforeEach(async ({ page }) => {
    // Ensure we start with English
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
    await page.reload();
    await waitForPageReady(page);
  });

  test('defaults to English', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible();
  });

  test('switches to Czech', async ({ page }) => {
    // Open the language select
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();

    // Select Czech
    await page.getByRole('option', { name: /Čeština/ }).click();

    // Wait for potential page reload after locale change
    await waitForPageReady(page);

    // Verify headline changed to Czech
    await expect(
      page.getByRole('heading', { name: 'Spravujte svůj sportovní tým bez námahy' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('switches back to English from Czech', async ({ page }) => {
    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();
    await waitForPageReady(page);

    // Verify Czech
    await expect(
      page.getByRole('heading', { name: 'Spravujte svůj sportovní tým bez námahy' }),
    ).toBeVisible({ timeout: 10000 });

    // Switch back to English
    await trigger.click();
    await page.getByRole('option', { name: /English/ }).click();
    await waitForPageReady(page);

    // Verify English
    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('language switch updates footer text', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toContainText('Built for teams that use Discord');

    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();
    await waitForPageReady(page);

    // Verify footer changed
    await expect(footer).toContainText('Vytvořeno pro týmy používající Discord', {
      timeout: 10000,
    });
  });

  test('language switch updates sign-in button text', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Sign in with Discord/ })).toBeVisible();

    // Switch to Czech
    const trigger = page.locator('header').getByRole('combobox');
    await trigger.click();
    await page.getByRole('option', { name: /Čeština/ }).click();
    await waitForPageReady(page);

    // Verify sign-in button changed
    await expect(page.getByRole('link', { name: /Přihlásit se přes Discord/ })).toBeVisible({
      timeout: 10000,
    });
  });
});
