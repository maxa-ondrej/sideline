import { chromium, type FullConfig } from '@playwright/test';

/**
 * Global setup that pre-warms the Vite dev server before any tests run.
 *
 * Vite 8 (rolldown-based optimizer) re-optimises discovered dependencies after
 * the first page load, temporarily invalidating module hash URLs and triggering
 * a WebSocket full-reload. If a test calls page.reload() or page.goto('/') a
 * second time during that optimisation window the page gets stuck at the loading
 * spinner because route-module URLs return 404.
 *
 * By loading the page once here — before any test workers start — we ensure the
 * optimisation cycle completes and the vite server is stable for the entire test
 * run.
 */
export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseUrl = config.use?.baseURL ?? 'http://localhost:3000';

  // Provide the same minimal auth mocks as unauthenticatedTest so the page
  // renders properly without a real API server.
  const apiOnlyFulfill =
    (status: number, body: string) => async (route: import('@playwright/test').Route) => {
      const type = route.request().resourceType();
      if (type !== 'fetch' && type !== 'xhr') {
        await route.fallback();
        return;
      }
      await route.fulfill({ status, contentType: 'application/json', body });
    };

  await page.route('**/auth/me', apiOnlyFulfill(401, '{}'));
  await page.route(
    '**/auth/login/url',
    apiOnlyFulfill(200, JSON.stringify('http://localhost:3000/mock-login')),
  );

  try {
    // First navigation: triggers vite dep discovery and optimisation
    await page.goto(baseUrl, { timeout: 60_000 });

    // Wait for React to finish rendering (no "Loading…" spinner)
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30_000,
    });

    // Vite 8 sends a WebSocket full-reload once optimisation finishes.
    // That reload causes a navigation; wait for it (up to 15 s).
    // If no navigation arrives vite was already stable — proceed immediately.
    const reloaded = await page
      .waitForEvent('framenavigated', { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (reloaded) {
      // Wait for the freshly-reloaded page to be ready
      await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
        timeout: 30_000,
      });
    }
    // Vite optimisation is now complete; subsequent page.reload() calls in
    // theme tests will find a stable module graph.
  } finally {
    await browser.close();
  }
}
