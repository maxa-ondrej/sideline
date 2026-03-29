import { expect, unauthenticatedTest as test } from '../fixtures/api-mocks.js';

test.describe('Responsive Layout', () => {
  test('mobile viewport renders key content', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Manage your sports team, effortlessly' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in with Discord/ })).toBeVisible();
    await expect(page.locator('header')).toContainText('Sideline');
    await expect(page.locator('footer')).toContainText('Built for teams that use Discord');
  });

  test('mobile viewport hides workout badge in hero', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Team and Events badges are visible
    await expect(page.getByText('Team Management').first()).toBeVisible();
    await expect(page.getByText('Events & RSVP').first()).toBeVisible();

    // Workout badge is hidden on mobile (has 'hidden sm:inline-flex')
    const workoutBadges = page.locator('text=Workout Tracking');
    const heroWorkoutBadge = workoutBadges.first();
    await expect(heroWorkoutBadge).toBeHidden();
  });

  test('desktop viewport shows workout badge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // All badges visible on desktop
    await expect(page.getByText('Team Management').first()).toBeVisible();
    await expect(page.getByText('Events & RSVP').first()).toBeVisible();
    // The workout badge in the hero section should be visible on desktop
    const workoutBadges = page.locator('text=Workout Tracking');
    await expect(workoutBadges.first()).toBeVisible();
  });

  test('header is visible at all viewport widths', async ({ page }) => {
    const widths = [375, 768, 1280];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header).toContainText('Sideline');
    }
  });

  test('footer is visible at all viewport widths', async ({ page }) => {
    const widths = [375, 768, 1280];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    }
  });

  test('demo widgets are visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByText('Your Stats')).toBeVisible();
    await expect(page.getByText('Next Event')).toBeVisible();
    await expect(page.getByText('Leaderboard').first()).toBeVisible();
    await expect(page.getByText('Awaiting RSVP')).toBeVisible();
  });

  test('demo widgets are visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByText('Your Stats')).toBeVisible();
    await expect(page.getByText('Next Event')).toBeVisible();
    await expect(page.getByText('Leaderboard').first()).toBeVisible();
    await expect(page.getByText('Awaiting RSVP')).toBeVisible();
  });
});
