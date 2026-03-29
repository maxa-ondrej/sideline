import { expect, incompleteProfileTest, test } from '../fixtures/api-mocks.js';

test.setTimeout(60000);

test.describe('Profile Page (/profile)', () => {
  test('page loads and shows profile page', async ({ page }) => {
    await page.goto('/profile');
    // Wait for the profile page to render
    await expect(page.getByText('My Profile').first()).toBeVisible({ timeout: 30000 });
  });

  test('shows user name in profile form', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('My Profile').first()).toBeVisible({ timeout: 30000 });
    // The name "Test User" is in an input field
    await expect(page.getByRole('textbox', { name: /Display Name/ })).toHaveValue('Test User');
  });
});

incompleteProfileTest.describe('Profile Complete Page', () => {
  incompleteProfileTest(
    'incomplete profile user gets redirected to profile completion',
    async ({ page }) => {
      await page.goto('/profile');
      await page.waitForURL('**/profile/complete', { timeout: 30000 });
      await expect(page).toHaveURL(/\/profile\/complete/);
    },
  );

  incompleteProfileTest(
    'profile completion page shows form fields (name input)',
    async ({ page }) => {
      await page.goto('/profile/complete');
      await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
        timeout: 30000,
      });
      await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });
    },
  );
});
