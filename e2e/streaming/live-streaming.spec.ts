import { test, expect } from '@playwright/test';
import { generateTestEmail, login, signup } from '../utils/test-utils';

test.describe('Live streaming flows', () => {
  const streamArtistEmail = generateTestEmail('stream-artist');
  const streamArtistPassword = 'Password123!';
  const streamFanEmail = generateTestEmail('stream-fan');
  const streamFanPassword = 'Password123!';

  test('artist can access streaming dashboard', async ({ page }) => {
    await signup(page, streamArtistEmail, streamArtistPassword, 'Stream Artist', 'artist');
    await page.goto('/dashboard/artist/streaming');

    // Should show streaming controls
    await expect(
      page.locator('text=/stream|go live|broadcast/i').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('streaming page is accessible to logged-in users', async ({ page }) => {
    await signup(page, streamFanEmail, streamFanPassword, 'Stream Fan', 'fan');
    await page.goto('/livestream');

    // Should show live streams or empty state
    await expect(page.locator('body')).not.toContainText('500');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('stream API health check', async ({ request }) => {
    const response = await request.get('/api/streaming');
    expect(response.status()).not.toBe(404);
  });

  test('fan can view a stream page', async ({ page }) => {
    await login(page, streamFanEmail, streamFanPassword, 'fan');

    // Navigate to streams listing
    await page.goto('/livestream');

    // Should render without errors
    const errorText = await page.locator('text=/error|500/i').count();
    expect(errorText).toBe(0);
  });
});
