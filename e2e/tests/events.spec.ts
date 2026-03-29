import { expect, test } from '../fixtures/api-mocks.js';
import { EVENT_ID, TEAM_ID } from '../fixtures/mock-data.js';

test.describe('Events List', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`/teams/${TEAM_ID}/events`);
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible({ timeout: 30000 });
  });

  test('page loads and shows events list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  });

  test('shows "Weekly Training" event', async ({ page }) => {
    await expect(page.getByText('Weekly Training').first()).toBeVisible();
  });

  test('shows "Friendly Match" event', async ({ page }) => {
    await expect(page.getByText('Friendly Match').first()).toBeVisible();
  });

  test('can click on event to navigate to detail', async ({ page }) => {
    await page.getByText('Weekly Training').first().click();
    await expect(page).toHaveURL(new RegExp(`/teams/${TEAM_ID}/events/`), { timeout: 30000 });
  });
});

test.describe('Event Detail', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`/teams/${TEAM_ID}/events/${EVENT_ID}`);
    // Wait for the page to show event content (title may be in heading or form)
    await expect(page.getByText('Weekly Training').first()).toBeVisible({ timeout: 30000 });
  });

  test('page loads and shows event title', async ({ page }) => {
    await expect(page.getByText('Weekly Training').first()).toBeVisible();
  });

  test('shows event details', async ({ page }) => {
    // Training type name appears on the page
    await expect(page.getByText('Goalkeeping').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows RSVP section', async ({ page }) => {
    // The RSVP section should be visible
    await expect(page.getByRole('button', { name: /Yes/ }).first()).toBeVisible({ timeout: 10000 });
  });
});
