import { expect, unauthenticatedTest as test } from '../fixtures/api-mocks.js';

test.describe('Theme Toggle', () => {
  // Theme tests that reload the page can be slow in CI
  test.setTimeout(120000);

  async function waitForPageReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 60000,
    });
  }

  test.beforeEach(async ({ page }) => {
    // Clear stored theme before the app scripts run to avoid an extra reload
    await page.addInitScript(() => {
      window.localStorage.removeItem('sideline-theme');
    });
    await page.goto('/');
    await waitForPageReady(page);
  });

  test('defaults to system theme with no stored preference', async ({ page }) => {
    const stored = await page.evaluate(() => localStorage.getItem('sideline-theme'));
    expect(stored).toBeNull();
  });

  test('system theme applies dark class when prefers-color-scheme is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      window.localStorage.removeItem('sideline-theme');
    });
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('system theme omits dark class when prefers-color-scheme is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      window.localStorage.removeItem('sideline-theme');
    });
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('clicking theme toggle cycles through themes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      window.localStorage.removeItem('sideline-theme');
    });
    await page.reload();
    await waitForPageReady(page);

    const themeButton = page.locator('header').getByRole('button', { name: /Theme/ });

    // System -> Light (click 1)
    await themeButton.click();
    const afterFirst = await page.evaluate(() => localStorage.getItem('sideline-theme'));
    expect(afterFirst).toBe('light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Light -> Dark (click 2)
    await themeButton.click();
    const afterSecond = await page.evaluate(() => localStorage.getItem('sideline-theme'));
    expect(afterSecond).toBe('dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Dark -> System (click 3)
    await themeButton.click();
    const afterThird = await page.evaluate(() => localStorage.getItem('sideline-theme'));
    expect(afterThird).toBe('system');
  });

  test('persists theme across page reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const themeButton = page.locator('header').getByRole('button', { name: /Theme/ });

    // Set to dark: system -> light -> dark
    await themeButton.click();
    await themeButton.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Verify localStorage was set before reloading
    const stored = await page.evaluate(() => localStorage.getItem('sideline-theme'));
    expect(stored).toBe('dark');

    // The beforeEach addInitScript clears the theme, so we add another one that
    // re-sets it. addInitScript is cumulative and runs in order, so this runs
    // after the removal and restores the value before the app reads it.
    await page.addInitScript(() => {
      window.localStorage.setItem('sideline-theme', 'dark');
    });
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 10000 });
  });

  test('light theme removes dark class', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      window.localStorage.setItem('sideline-theme', 'light');
    });
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('dark theme adds dark class regardless of system preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      window.localStorage.setItem('sideline-theme', 'dark');
    });
    await page.reload();
    await waitForPageReady(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
