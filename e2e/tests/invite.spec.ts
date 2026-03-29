import { expect, test } from '../fixtures/api-mocks.js';
import { INVITE_CODE } from '../fixtures/mock-data.js';

test.setTimeout(60000);

test.describe('Invite Page', () => {
  test('page loads and shows invite information', async ({ page }) => {
    await page.goto(`/invite/${INVITE_CODE}`);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), {
      timeout: 30000,
    });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('shows team name in invite', async ({ page }) => {
    await page.goto(`/invite/${INVITE_CODE}`);
    // The invite page shows "Join Test Team" and "invited to join Test Team"
    await expect(page.getByText('Join Test Team', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});
