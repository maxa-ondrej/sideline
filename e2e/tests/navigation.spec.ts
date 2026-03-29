import { expect, unauthenticatedTest as test } from '../fixtures/api-mocks.js';

// Navigation tests may be slow because beforeLoad calls fetchEnv() and getCurrentUser()
// which can time out when the backend is unavailable.
test.describe('Navigation & Routing', () => {
  test.setTimeout(120000);
  test('homepage loads with 200 status', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('authenticated route /profile redirects to homepage', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL('/', { timeout: 60000 });
    await expect(page).toHaveURL('/');
  });

  test('authenticated route /create-team redirects to homepage', async ({ page }) => {
    await page.goto('/create-team');
    await page.waitForURL('/', { timeout: 60000 });
    await expect(page).toHaveURL('/');
  });

  test('authenticated route /teams/:id redirects to homepage', async ({ page }) => {
    await page.goto('/teams/some-nonexistent-team');
    await page.waitForURL('/', { timeout: 60000 });
    await expect(page).toHaveURL('/');
  });

  test('authenticated route /teams/:id/events redirects to homepage', async ({ page }) => {
    await page.goto('/teams/some-team/events');
    await page.waitForURL('/', { timeout: 60000 });
    await expect(page).toHaveURL('/');
  });

  test('authenticated route /teams/:id/members redirects to homepage', async ({ page }) => {
    await page.goto('/teams/some-team/members');
    await page.waitForURL('/', { timeout: 60000 });
    await expect(page).toHaveURL('/');
  });

  test('error query param displays error state', async ({ page }) => {
    await page.goto('/?error=auth&reason=access_denied');
    // Wait for loading to finish
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    await expect(page.getByText('You denied the Discord authorization request.')).toBeVisible({
      timeout: 10000,
    });
  });

  test('error state shows try again button', async ({ page }) => {
    await page.goto('/?error=auth&reason=oauth_failed');
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    await expect(
      page.getByText('Discord login failed. The authorization code may have expired.'),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /Try again/ })).toBeVisible();
  });

  test('error state for missing params reason', async ({ page }) => {
    await page.goto('/?error=auth&reason=missing_params');
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    await expect(
      page.getByText('The login response was incomplete. Please try again.'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('error state for internal error reason', async ({ page }) => {
    await page.goto('/?error=auth&reason=internal_error');
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    await expect(
      page.getByText('An unexpected error occurred. Please try again later.'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('error state for unknown reason falls back to default message', async ({ page }) => {
    await page.goto('/?error=auth&reason=unknown_reason');
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    await expect(page.getByText('Login failed. Please try again.')).toBeVisible({
      timeout: 10000,
    });
  });

  test('no uncaught exceptions on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });

    expect(errors).toEqual([]);
  });
});
