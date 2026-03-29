import { expect, test } from '../fixtures/api-mocks.js';
import { MEMBER_ID, TEAM_ID } from '../fixtures/mock-data.js';

test.describe('Members', () => {
  test.setTimeout(60000);

  test.describe('Members List', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/teams/${TEAM_ID}/members`);
      // Wait for members table to render
      await expect(page.getByText('Test User').first()).toBeVisible({ timeout: 30000 });
    });

    test('page loads and shows members list', async ({ page }) => {
      await expect(page.getByText('Test User').first()).toBeVisible();
    });

    test('shows member with Admin role', async ({ page }) => {
      const testUserRow = page.getByRole('row').filter({ hasText: 'Test User' });
      await expect(testUserRow).toContainText('Admin');
    });

    test('shows Jane Player with Player role', async ({ page }) => {
      await expect(page.getByText('Jane Player').first()).toBeVisible();
      const janeRow = page.getByRole('row').filter({ hasText: 'Jane Player' });
      await expect(janeRow).toContainText('Player');
    });

    test('can click on member to navigate to detail', async ({ page }) => {
      // Click on the first edit link
      const editLink = page.getByRole('link', { name: /Edit/ }).first();
      await editLink.click();
      await expect(page).toHaveURL(new RegExp(`/teams/${TEAM_ID}/members/`), { timeout: 30000 });
    });
  });

  test.describe('Member Detail', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/teams/${TEAM_ID}/members/${MEMBER_ID}`);
      // Wait for the member detail page to load
      await expect(page.getByRole('heading', { name: 'Test User' }).first()).toBeVisible({
        timeout: 30000,
      });
    });

    test('page loads and shows member name', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Test User' }).first()).toBeVisible();
    });

    test('shows member role', async ({ page }) => {
      await expect(page.getByText('Admin').first()).toBeVisible();
    });

    test('shows activity stats', async ({ page }) => {
      await expect(page.getByText('Activity Stats').first()).toBeVisible({ timeout: 10000 });
    });
  });
});
