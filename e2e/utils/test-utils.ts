import { Page, expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

/**
 * Login as a user with the specified role
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  role: 'artist' | 'fan' = 'fan'
) {
  await page.goto('/auth/signin');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL(/dashboard\/(artist|fan)/);

  // Verify we're logged in by checking for dashboard elements
  if (role === 'artist') {
    await expect(page.getByText('Artist Dashboard')).toBeVisible();
  } else {
    await expect(page.getByText('Fan Dashboard')).toBeVisible();
  }
}

/**
 * Sign up a new user
 */
export async function signup(
  page: Page,
  email: string,
  password: string,
  displayName: string,
  role: 'artist' | 'fan' = 'fan'
) {
  await page.goto('/auth/signup');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="displayName"]', displayName);

  // Select role
  await page.selectOption('select[name="role"]', role);

  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL(/dashboard\/(artist|fan)/);
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Logout the current user
 */
export async function logout(page: Page) {
  await page.click('button[aria-label="Open user menu"]');
  await page.click('button:has-text("Sign out")');

  // Wait for navigation to complete
  await page.waitForURL('/');
}

/**
 * Create a test tier for an artist
 */
export async function createTier(
  page: Page,
  name: string,
  description: string,
  minimumPrice: number
) {
  await page.goto('/dashboard/artist');
  await page.click('a:has-text("Manage Tiers")');
  await page.click('button:has-text("Create New Tier")');

  await page.fill('input[name="name"]', name);
  await page.fill('textarea[name="description"]', description);
  await page.fill('input[name="minimumPrice"]', minimumPrice.toString());

  await page.click('button[type="submit"]');

  // Wait for the tier to be created
  await expect(page.getByText(`Tier "${name}" created successfully`)).toBeVisible();
}

/**
 * Subscribe a fan to an artist's tier
 */
export async function subscribeToTier(
  page: Page,
  artistId: string,
  tierId: string,
  amount: number
) {
  await page.goto(`/artist/${artistId}`);

  // Find and click the subscribe button for the specific tier
  await page.click(`[data-tier-id="${tierId}"] button:has-text("Subscribe")`);

  // Enter custom amount if different from minimum
  await page.fill('input[name="amount"]', amount.toString());

  // Complete checkout
  await page.click('button:has-text("Proceed to Checkout")');

  // This would normally redirect to Stripe, but for testing we'll mock it
  // Wait for the success page
  await page.waitForURL(/success/);
}

/**
 * Upload test content as an artist
 */
export async function uploadContent(
  page: Page,
  title: string,
  description: string,
  filePath: string,
  tierIds: string[]
) {
  await page.goto('/dashboard/artist');
  await page.click('a:has-text("Manage Content")');
  await page.click('button:has-text("Upload New Content")');

  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', description);

  // Upload file
  await page.setInputFiles('input[type="file"]', filePath);

  // Select tiers
  for (const tierId of tierIds) {
    await page.check(`input[value="${tierId}"]`);
  }

  await page.click('button[type="submit"]');

  // Wait for upload to complete
  await expect(page.getByText(`Content "${title}" uploaded successfully`)).toBeVisible();
}
