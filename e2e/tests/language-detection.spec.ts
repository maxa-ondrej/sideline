import { expect, unauthenticatedTest as test } from '../fixtures/api-mocks.js';

/**
 * E2E tests for browser language auto-detection via the Paraglide `preferredLanguage` strategy.
 *
 * The `preferredLanguage` strategy reads `navigator.languages` (which Playwright
 * controls via the `locale` option) and auto-selects the locale on first visit.
 * The result is persisted to localStorage under the key `PARAGLIDE_LOCALE`.
 *
 * The `preferredLanguage` strategy is configured in the Paraglide compile
 * command in `packages/i18n/package.json`.
 */

// Reliable text that differs between EN and CS on the unauthenticated homepage.
// EN: "Sign in with Discord"  — from auth_signInDiscord in en.json
// CS: "Přihlásit se přes Discord" — from auth_signInDiscord in cs.json
const EN_SIGN_IN = 'Sign in with Discord';
const CS_SIGN_IN = 'Přihlásit se přes Discord';

async function waitForPageReady(page: import('@playwright/test').Page) {
  // Wait for the <header> element which only appears after React has fully
  // rendered. The raw HTML shell never contains a <header>.
  await page.waitForSelector('header', { timeout: 30000 });
}

// ---------------------------------------------------------------------------
// Test group 1: Czech browser (cs-CZ locale) → Czech UI
// ---------------------------------------------------------------------------
test.describe('Czech browser locale', () => {
  test.use({ locale: 'cs-CZ' });

  test('Czech browser sees Czech text on first visit', async ({ page }) => {
    // Clear any stored locale so browser detection runs fresh
    await page.addInitScript(() => {
      window.localStorage.removeItem('PARAGLIDE_LOCALE');
    });

    await page.goto('/');
    await waitForPageReady(page);

    // The sign-in button must be in Czech
    await expect(page.getByRole('link', { name: CS_SIGN_IN })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 2: English browser (en-US locale, default) → English UI
// ---------------------------------------------------------------------------
test.describe('English browser locale', () => {
  // en-US is already the global default in playwright.config.ts, but we set it
  // explicitly here for clarity and isolation.
  test.use({ locale: 'en-US' });

  test('English browser sees English text on first visit', async ({ page }) => {
    // Clear any stored locale so browser detection runs fresh
    await page.addInitScript(() => {
      window.localStorage.removeItem('PARAGLIDE_LOCALE');
    });

    await page.goto('/');
    await waitForPageReady(page);

    // The sign-in button must be in English
    await expect(page.getByRole('link', { name: EN_SIGN_IN })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Unsupported locale (ja-JP) → falls back to English
// ---------------------------------------------------------------------------
test.describe('Unsupported browser locale', () => {
  test.use({ locale: 'ja-JP' });

  test('Unsupported browser language falls back to English', async ({ page }) => {
    // Clear any stored locale so browser detection runs fresh
    await page.addInitScript(() => {
      window.localStorage.removeItem('PARAGLIDE_LOCALE');
    });

    await page.goto('/');
    await waitForPageReady(page);

    // Japanese is not a supported locale; the app must fall back to English
    await expect(page.getByRole('link', { name: EN_SIGN_IN })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 4: localStorage choice overrides browser language
// ---------------------------------------------------------------------------
test.describe('localStorage overrides browser locale', () => {
  // Browser is Czech, but localStorage already has 'en' stored
  test.use({ locale: 'cs-CZ' });

  test('Manual localStorage choice overrides browser language', async ({ page }) => {
    // Pre-set the stored locale to English before the app loads
    await page.addInitScript(() => {
      window.localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    });

    await page.goto('/');
    await waitForPageReady(page);

    // Despite Czech browser locale, stored 'en' preference must win
    await expect(page.getByRole('link', { name: EN_SIGN_IN })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 5: Language switcher persists choice over browser detection
// ---------------------------------------------------------------------------
test.describe('Language switcher persistence', () => {
  // Browser is Czech so the first load (without stored preference) shows Czech
  test.use({ locale: 'cs-CZ' });

  test('Language switcher choice persists over browser detection on reload', async ({ page }) => {
    // Clear stored locale so browser detection kicks in on the first visit
    await page.addInitScript(() => {
      window.localStorage.removeItem('PARAGLIDE_LOCALE');
    });

    await page.goto('/');
    await waitForPageReady(page);

    // First visit: browser is Czech → page should show Czech
    await expect(page.getByRole('link', { name: CS_SIGN_IN })).toBeVisible();

    // Switch to English via the LanguageSwitcher combobox in the header
    const languageSwitcher = page.locator('header').getByRole('combobox');
    await languageSwitcher.click();

    // Select the English option from the dropdown
    await page.getByRole('option', { name: /English/ }).click();

    // After switching, the sign-in button should now be in English
    await expect(page.getByRole('link', { name: EN_SIGN_IN })).toBeVisible();

    // Reload the page — localStorage should take precedence over browser locale
    await page.reload();
    await waitForPageReady(page);

    // Even though browser is cs-CZ, the stored 'en' choice must win
    await expect(page.getByRole('link', { name: EN_SIGN_IN })).toBeVisible();
  });
});
