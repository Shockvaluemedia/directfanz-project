import { test, expect } from '@playwright/test';
import { 
  generateTestEmail, 
  signup, 
  login, 
  createTier, 
  uploadContent, 
  subscribeToTier, 
  logout 
} from './utils/test-utils';

/**
 * Integration Test Suite
 * 
 * This test suite verifies complete user flows and integration between
 * different components of the Direct Fan Platform.
 */
test.describe('Complete Integration Tests', () => {
  // Test data
  const artistEmail = generateTestEmail('integration-artist');
  const artistPassword = 'ArtistTest123!';
  const artistName = 'Integration Test Artist';
  
  const fanEmail = generateTestEmail('integration-fan');
  const fanPassword = 'FanTest123!';
  const fanName = 'Integration Test Fan';
  
  const tierName = 'Premium Integration Tier';
  const tierDescription = 'Access to exclusive integration test content';
  const tierPrice = 5.99;
  
  const contentTitle = 'Integration Test Track';
  const contentDescription = 'A test track for integration testing';
  
  // Artist journey
  test('complete artist journey', async ({ page, browser }) => {
    // 1. Artist signup
    test.info().annotations.push({
      type: 'step',
      description: 'Artist signup and onboarding',
    });
    
    await signup(page, artistEmail, artistPassword, artistName, 'artist');
    await expect(page.getByText('Artist Dashboard')).toBeVisible();
    
    // 2. Complete artist profile
    test.info().annotations.push({
      type: 'step',
      description: 'Complete artist profile',
    });
    
    await page.click('a:has-text("Edit Profile")');
    await page.fill('textarea[name="bio"]', 'This is an integration test artist profile');
    await page.selectOption('select[name="genre"]', 'rock');
    await page.fill('input[name="instagram"]', 'integration_test');
    await page.click('button[type="submit"]');
    
    await expect(page.getByText('Profile updated successfully')).toBeVisible();
    
    // 3. Connect Stripe (mock)
    test.info().annotations.push({
      type: 'step',
      description: 'Connect Stripe account',
    });
    
    await page.click('a:has-text("Connect Payment Account")');
    // This would normally redirect to Stripe, but for testing we'll mock it
    await page.goto('/api/artist/stripe/onboard/return?success=true');
    
    // 4. Create subscription tier
    test.info().annotations.push({
      type: 'step',
      description: 'Create subscription tier',
    });
    
    await createTier(page, tierName, tierDescription, tierPrice);
    
    // 5. Upload content
    test.info().annotations.push({
      type: 'step',
      description: 'Upload content',
    });
    
    await page.goto('/dashboard/artist');
    await page.click('a:has-text("Manage Content")');
    await page.click('button:has-text("Upload New Content")');
    
    await page.fill('input[name="title"]', contentTitle);
    await page.fill('textarea[name="description"]', contentDescription);
    
    // Mock file selection
    await page.evaluate(() => {
      // Create a mock file input event
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: [new File([''], 'test-file.mp3', { type: 'audio/mp3' })],
        });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Get the tier ID from the page
    const tierId = await page.evaluate(() => {
      const tierCheckbox = document.querySelector('input[type="checkbox"][name^="tiers"]');
      return tierCheckbox ? tierCheckbox.value : 'tier-1';
    });
    
    // Select tier
    await page.check(`input[value="${tierId}"]`);
    
    await page.click('button[type="submit"]');
    
    // Verify content was uploaded
    await expect(page.getByText(/Content .* uploaded|created/)).toBeVisible();
    
    // 6. Check analytics dashboard
    test.info().annotations.push({
      type: 'step',
      description: 'Check analytics dashboard',
    });
    
    await page.goto('/dashboard/artist');
    await page.click('a:has-text("Analytics")');
    
    // Verify analytics components are visible
    await expect(page.getByText('Earnings Overview')).toBeVisible();
    await expect(page.getByText('Subscriber Growth')).toBeVisible();
    
    // Logout as artist
    await logout(page);
  });
  
  // Fan journey
  test('complete fan journey', async ({ page, browser }) => {
    // 1. Fan signup
    test.info().annotations.push({
      type: 'step',
      description: 'Fan signup',
    });
    
    await signup(page, fanEmail, fanPassword, fanName, 'fan');
    await expect(page.getByText('Fan Dashboard')).toBeVisible();
    
    // 2. Discover artists
    test.info().annotations.push({
      type: 'step',
      description: 'Discover artists',
    });
    
    await page.goto('/discover');
    
    // Search for the integration test artist
    await page.fill('input[name="search"]', artistName);
    await page.click('button[aria-label="Search"]');
    
    // 3. View artist profile
    test.info().annotations.push({
      type: 'step',
      description: 'View artist profile',
    });
    
    // Click on the artist card
    await page.click(`.artist-card:has-text("${artistName}")`);
    
    // Verify artist profile elements
    await expect(page.getByText('Subscription Tiers')).toBeVisible();
    await expect(page.getByText(tierName)).toBeVisible();
    
    // 4. Subscribe to tier
    test.info().annotations.push({
      type: 'step',
      description: 'Subscribe to artist tier',
    });
    
    // Get the tier ID from the page
    const tierId = await page.evaluate((tierName) => {
      const tierElement = Array.from(document.querySelectorAll('[data-tier-name]'))
        .find(el => el.textContent?.includes(tierName));
      return tierElement ? tierElement.getAttribute('data-tier-id') : 'tier-1';
    }, tierName);
    
    // Subscribe to the tier
    await page.click(`[data-tier-id="${tierId}"] button:has-text("Subscribe")`);
    
    // Enter custom amount
    await page.fill('input[name="amount"]', '10.00');
    
    // Proceed to checkout
    await page.click('button:has-text("Proceed to Checkout")');
    
    // This would normally redirect to Stripe, but for testing we'll mock it
    // Simulate returning from Stripe checkout
    await page.goto('/api/payments/checkout/success?session_id=test_session');
    
    // Verify subscription success
    await expect(page.getByText('Subscription Successful')).toBeVisible();
    
    // 5. Access content
    test.info().annotations.push({
      type: 'step',
      description: 'Access subscribed content',
    });
    
    // Navigate to artist content
    await page.goto('/dashboard/fan');
    await page.click('a:has-text("My Subscriptions")');
    await page.click(`a:has-text("${artistName}")`);
    
    // Verify content is accessible
    await expect(page.getByText('Exclusive Content')).toBeVisible();
    await expect(page.getByText(contentTitle)).toBeVisible();
    
    // 6. Play content
    test.info().annotations.push({
      type: 'step',
      description: 'Play content',
    });
    
    // Click on the content item
    await page.click(`.content-item:has-text("${contentTitle}") button:has-text("Play")`);
    
    // Verify media player appears
    await expect(page.locator('.media-player')).toBeVisible();
    
    // 7. Add comment
    test.info().annotations.push({
      type: 'step',
      description: 'Comment on content',
    });
    
    // Navigate to content detail page
    await page.click(`.content-item:has-text("${contentTitle}") a:has-text("Details")`);
    
    // Add a comment
    const testComment = 'This is a great integration test!';
    await page.fill('textarea[name="comment"]', testComment);
    await page.click('button:has-text("Post Comment")');
    
    // Verify comment was added
    await expect(page.getByText(testComment)).toBeVisible();
    
    // 8. Manage subscription
    test.info().annotations.push({
      type: 'step',
      description: 'Manage subscription',
    });
    
    // Navigate to subscription management
    await page.goto('/dashboard/fan/subscriptions');
    
    // Verify subscription is listed
    await expect(page.getByText(artistName)).toBeVisible();
    await expect(page.getByText('$10.00/month')).toBeVisible();
    
    // Change subscription amount
    await page.click(`[data-artist-name="${artistName}"] button:has-text("Change Amount")`);
    await page.fill('input[name="newAmount"]', '15.00');
    await page.click('button:has-text("Update")');
    
    // Verify amount was updated
    await expect(page.getByText('$15.00/month')).toBeVisible();
    
    // Logout as fan
    await logout(page);
  });
  
  // Cross-user integration test
  test('artist sees new subscriber and comment', async ({ page }) => {
    // Login as artist
    await login(page, artistEmail, artistPassword, 'artist');
    
    // 1. Check subscriber count
    test.info().annotations.push({
      type: 'step',
      description: 'Artist checks subscriber count',
    });
    
    await page.goto('/dashboard/artist');
    
    // Verify subscriber count increased
    await expect(page.getByText('1 Subscriber')).toBeVisible();
    
    // 2. Check analytics
    test.info().annotations.push({
      type: 'step',
      description: 'Artist checks analytics',
    });
    
    await page.click('a:has-text("Analytics")');
    
    // Verify earnings are displayed
    await expect(page.getByText('$15.00')).toBeVisible();
    
    // 3. Check content comments
    test.info().annotations.push({
      type: 'step',
      description: 'Artist checks content comments',
    });
    
    await page.goto('/dashboard/artist');
    await page.click('a:has-text("Manage Content")');
    await page.click(`.content-item:has-text("${contentTitle}") a:has-text("Details")`);
    
    // Verify comment is visible
    await expect(page.getByText('This is a great integration test!')).toBeVisible();
    
    // 4. Reply to comment
    test.info().annotations.push({
      type: 'step',
      description: 'Artist replies to comment',
    });
    
    await page.click('button:has-text("Reply")');
    await page.fill('textarea[name="reply"]', 'Thank you for your support!');
    await page.click('button:has-text("Post Reply")');
    
    // Verify reply was added
    await expect(page.getByText('Thank you for your support!')).toBeVisible();
    
    // Logout as artist
    await logout(page);
  });
  
  // Fan sees artist reply
  test('fan sees artist reply', async ({ page }) => {
    // Login as fan
    await login(page, fanEmail, fanPassword, 'fan');
    
    // 1. Check notifications
    test.info().annotations.push({
      type: 'step',
      description: 'Fan checks notifications',
    });
    
    await page.goto('/dashboard/fan');
    
    // Click on notifications
    await page.click('button[aria-label="View notifications"]');
    
    // Verify notification about reply
    await expect(page.getByText('replied to your comment')).toBeVisible();
    
    // 2. View the reply
    test.info().annotations.push({
      type: 'step',
      description: 'Fan views artist reply',
    });
    
    // Click on the notification
    await page.click('a:has-text("replied to your comment")');
    
    // Verify on content page with reply visible
    await expect(page.getByText('Thank you for your support!')).toBeVisible();
    
    // Logout as fan
    await logout(page);
  });
});

/**
 * System Integration Tests
 * 
 * These tests verify that all system components work together properly
 */
test.describe('System Integration Tests', () => {
  // Test payment webhook handling
  test('payment webhook processing', async ({ request }) => {
    // This test simulates a Stripe webhook event
    const response = await request.post('/api/payments/webhooks', {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test_signature', // This will fail validation, but we can check the endpoint responds
      },
      data: JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            amount_total: 1500,
          }
        }
      })
    });
    
    // We expect a 400 because the signature is invalid, but the endpoint should respond
    expect(response.status()).toBe(400);
  });
  
  // Test content access control
  test('content access control', async ({ page }) => {
    // Create a new fan account
    const newFanEmail = generateTestEmail('access-test-fan');
    const newFanPassword = 'AccessTest123!';
    const newFanName = 'Access Test Fan';
    
    await signup(page, newFanEmail, newFanPassword, newFanName, 'fan');
    
    // Try to access premium content without subscription
    await page.goto('/discover');
    
    // Search for the integration test artist
    await page.fill('input[name="search"]', 'Integration Test Artist');
    await page.click('button[aria-label="Search"]');
    
    // Click on the artist card
    await page.click(`.artist-card:has-text("Integration Test Artist")`);
    
    // Try to access content
    await page.click('a:has-text("View Content")');
    
    // Verify content is locked
    await expect(page.getByText('Subscribe to access')).toBeVisible();
    
    // Logout
    await logout(page);
  });
  
  // Test error handling
  test('error handling and recovery', async ({ page }) => {
    // Test invalid login
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'InvalidPassword123!');
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    
    // Test form validation
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'short');
    await page.click('button[type="submit"]');
    
    // Verify validation errors
    await expect(page.getByText('Invalid email address')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });
  
  // Test accessibility features
  test('accessibility features', async ({ page }) => {
    await page.goto('/');
    
    // Test skip link
    await page.keyboard.press('Tab');
    await expect(page.getByText('Skip to content')).toBeFocused();
    
    // Test keyboard navigation
    await page.keyboard.press('Enter'); // Activate skip link
    await page.keyboard.press('Tab');
    
    // Verify focus is in the main content area
    const focusedElement = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement ? activeElement.tagName : null;
    });
    
    expect(focusedElement).not.toBe('BODY'); // Focus should be on an interactive element, not the body
  });
});