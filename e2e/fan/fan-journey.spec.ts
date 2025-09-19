import { test, expect } from '@playwright/test';
import { generateTestEmail, signup, login, subscribeToTier } from '../utils/test-utils';

test.describe('Fan journey', () => {
  // Use a single fan account for all tests in this file
  const fanEmail = generateTestEmail('fan-journey');
  const fanPassword = 'Password123!';
  const fanName = 'Test Fan Journey';

  test.beforeAll(async ({ browser }) => {
    // Create a test fan account that will be used for all tests
    const page = await browser.newPage();
    await signup(page, fanEmail, fanPassword, fanName, 'fan');
    await page.close();
  });

  test('should allow fan to discover artists', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to discovery page
    await page.goto('/discover');

    // Test search functionality
    await page.fill('input[name="search"]', 'rock');
    await page.click('button[aria-label="Search"]');

    // Test filtering
    await page.selectOption('select[name="genre"]', 'rock');

    // Verify artists are displayed
    await expect(page.locator('.artist-card')).toHaveCount(1);
  });

  test('should allow fan to view artist profile', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to an artist profile
    // For testing, we'll use a known artist ID
    const testArtistId = 'artist-1';
    await page.goto(`/artist/${testArtistId}`);

    // Verify artist profile elements
    await expect(page.getByText('Subscription Tiers')).toBeVisible();
    await expect(page.getByText('Recent Content')).toBeVisible();
  });

  test('should allow fan to subscribe to an artist tier', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to an artist profile
    const testArtistId = 'artist-1';
    const testTierId = 'tier-1';
    await page.goto(`/artist/${testArtistId}`);

    // Find and click the subscribe button for a specific tier
    await page.click(`[data-tier-id="${testTierId}"] button:has-text("Subscribe")`);

    // Enter custom amount
    await page.fill('input[name="amount"]', '10.00');

    // Proceed to checkout
    await page.click('button:has-text("Proceed to Checkout")');

    // This would normally redirect to Stripe, but for testing we'll mock it
    // Simulate returning from Stripe checkout
    await page.goto('/api/payments/checkout/success?session_id=test_session');

    // Verify subscription success
    await expect(page.getByText('Subscription Successful')).toBeVisible();
  });

  test('should allow fan to manage subscriptions', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to subscription management
    await page.goto('/dashboard/fan/subscriptions');

    // Verify subscription is listed
    await expect(page.getByText('Active Subscriptions')).toBeVisible();

    // Test changing subscription amount
    await page.click('button:has-text("Change Amount")');
    await page.fill('input[name="newAmount"]', '15.00');
    await page.click('button:has-text("Update")');

    // Verify amount was updated
    await expect(page.getByText('$15.00/month')).toBeVisible();
  });

  test('should allow fan to access subscribed content', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to artist content
    const testArtistId = 'artist-1';
    await page.goto(`/artist/${testArtistId}/content`);

    // Verify content is accessible
    await expect(page.getByText('Exclusive Content')).toBeVisible();

    // Test playing content
    await page.click('.content-item:first-child button:has-text("Play")');

    // Verify media player appears
    await expect(page.locator('.media-player')).toBeVisible();
  });

  test('should allow fan to comment on content', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    // Navigate to a content item
    const testArtistId = 'artist-1';
    const testContentId = 'content-1';
    await page.goto(`/artist/${testArtistId}/content/${testContentId}`);

    // Add a comment
    const testComment = 'This is amazing!';
    await page.fill('textarea[name="comment"]', testComment);
    await page.click('button:has-text("Post Comment")');

    // Verify comment was added
    await expect(page.getByText(testComment)).toBeVisible();
  });
});
