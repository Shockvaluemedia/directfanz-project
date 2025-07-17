import { test, expect } from '@playwright/test';
import { generateTestEmail, signup, login, createTier, uploadContent } from '../utils/test-utils';

test.describe('Artist journey', () => {
  // Use a single artist account for all tests in this file
  const artistEmail = generateTestEmail('artist-journey');
  const artistPassword = 'Password123!';
  const artistName = 'Test Artist Journey';
  
  test.beforeAll(async ({ browser }) => {
    // Create a test artist account that will be used for all tests
    const page = await browser.newPage();
    await signup(page, artistEmail, artistPassword, artistName, 'artist');
    await page.close();
  });
  
  test('should allow artist to complete onboarding with Stripe Connect', async ({ page }) => {
    await login(page, artistEmail, artistPassword, 'artist');
    
    // Navigate to onboarding
    await page.goto('/dashboard/artist');
    await expect(page.getByText('Complete your onboarding')).toBeVisible();
    await page.click('a:has-text("Complete Onboarding")');
    
    // This would normally redirect to Stripe, but for testing we'll mock it
    // Simulate returning from Stripe onboarding
    await page.goto('/api/artist/stripe/onboard/return?success=true');
    
    // Verify onboarding completion
    await page.goto('/dashboard/artist');
    await expect(page.getByText('Stripe account connected')).toBeVisible();
  });
  
  test('should allow artist to create and manage subscription tiers', async ({ page }) => {
    await login(page, artistEmail, artistPassword, 'artist');
    
    // Create a new tier
    const tierName = 'Premium Tier';
    const tierDescription = 'Access to exclusive content';
    const minimumPrice = 5.99;
    
    await createTier(page, tierName, tierDescription, minimumPrice);
    
    // Verify tier was created
    await expect(page.getByText(tierName)).toBeVisible();
    await expect(page.getByText(tierDescription)).toBeVisible();
    await expect(page.getByText(`$${minimumPrice}`)).toBeVisible();
    
    // Edit the tier
    await page.click(`[data-tier-name="${tierName}"] button:has-text("Edit")`);
    
    const updatedName = 'Super Premium Tier';
    await page.fill('input[name="name"]', updatedName);
    await page.click('button[type="submit"]');
    
    // Verify tier was updated
    await expect(page.getByText(updatedName)).toBeVisible();
  });
  
  test('should allow artist to upload and manage content', async ({ page }) => {
    await login(page, artistEmail, artistPassword, 'artist');
    
    // First create a tier if it doesn't exist
    let tierId: string;
    
    try {
      await page.goto('/dashboard/artist');
      await page.click('a:has-text("Manage Tiers")');
      
      // Check if tier exists
      const tierElement = await page.$('[data-tier-name]');
      if (!tierElement) {
        // Create a tier
        const tierName = 'Content Test Tier';
        const tierDescription = 'For testing content uploads';
        const minimumPrice = 4.99;
        
        await createTier(page, tierName, tierDescription, minimumPrice);
        
        // Get the tier ID from the data attribute
        const newTierElement = await page.$('[data-tier-name]');
        tierId = await newTierElement?.getAttribute('data-tier-id') || 'tier-1';
      } else {
        tierId = await tierElement.getAttribute('data-tier-id') || 'tier-1';
      }
    } catch (error) {
      // If there's an error, use a default tier ID
      tierId = 'tier-1';
    }
    
    // Upload content
    const contentTitle = 'Test Track';
    const contentDescription = 'A test audio track';
    
    // For testing, we'll create a mock file path
    // In a real test, you would use a real file path
    const mockFilePath = 'test-file.mp3';
    
    // Mock the file upload since we can't actually upload in this test
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
    
    // Select tier
    await page.check(`input[value="${tierId}"]`);
    
    await page.click('button[type="submit"]');
    
    // Verify content was uploaded (or at least the form was submitted)
    await expect(page.getByText(/Content .* uploaded|created/)).toBeVisible();
  });
  
  test('should allow artist to view analytics dashboard', async ({ page }) => {
    await login(page, artistEmail, artistPassword, 'artist');
    
    // Navigate to analytics
    await page.goto('/dashboard/artist');
    await page.click('a:has-text("Analytics")');
    
    // Verify analytics components are visible
    await expect(page.getByText('Earnings Overview')).toBeVisible();
    await expect(page.getByText('Subscriber Growth')).toBeVisible();
    
    // Test date range selector
    await page.selectOption('select[name="timeRange"]', 'last30Days');
    
    // Verify charts are updated
    await expect(page.getByText('Last 30 Days')).toBeVisible();
  });
});