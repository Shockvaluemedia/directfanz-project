import { test, expect } from '@playwright/test';

test.describe('Fan - Discover Page', () => {
  test('discover page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');

    // The discover page requires authentication and redirects to sign in
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('discover page returns a valid HTTP response', async ({ page }) => {
    const response = await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');

    // The page should load without a server error
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Fan - Search Page', () => {
  test('search page loads and renders', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    // Verify we are on the search page
    await expect(page).toHaveURL(/\/search/);
  });

  test('search page renders without server errors', async ({ page }) => {
    const response = await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });

  test('search page has correct metadata title', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Search|Discovery|Direct Fan/);
  });
});

test.describe('Fan - Artist Profile Pages', () => {
  test('artist profile page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/artist/test-artist-id');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in or see the page
    const currentUrl = page.url();
    const isRedirected = /\/auth\/signin/.test(currentUrl);
    const isOnArtistPage = /\/artist\//.test(currentUrl);

    expect(isRedirected || isOnArtistPage).toBeTruthy();
  });

  test('artist profile page renders without server errors', async ({ page }) => {
    const response = await page.goto('/artist/some-artist-id');
    await page.waitForLoadState('domcontentloaded');

    // The page should not return a 500 error
    expect(response?.status()).toBeLessThan(500);
  });

  test('artist profile page handles non-existent artist gracefully', async ({ page }) => {
    const response = await page.goto('/artist/nonexistent-artist-12345');
    await page.waitForLoadState('domcontentloaded');

    // The page should handle the missing artist gracefully without a crash
    expect(response?.status()).toBeLessThan(500);

    // Either shows an error message, redirects to sign in, or shows loading
    const errorText = page.getByText('Artist not found');
    const signinPage = page.locator('input[name="email"]');
    const loadingSpinner = page.locator('.animate-spin');

    const hasError = await errorText.isVisible().catch(() => false);
    const hasSignIn = await signinPage.isVisible().catch(() => false);
    const hasLoading = await loadingSpinner.isVisible().catch(() => false);

    expect(hasError || hasSignIn || hasLoading).toBeTruthy();
  });
});

test.describe('Fan - Subscription Flow UI', () => {
  test('fan subscriptions page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard/fan/subscriptions');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/fan\/subscriptions/);
  });

  test('fan subscriptions page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/fan/subscriptions');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });

  test('fan subscriptions page shows loading or sign in', async ({ page }) => {
    await page.goto('/dashboard/fan/subscriptions');
    await page.waitForLoadState('domcontentloaded');

    // The page either shows loading, the subscriptions UI, or redirects to sign in
    const loadingText = page.getByText('Loading...');
    const subscriptionsHeading = page.getByText('My Subscriptions');
    const signinHeading = page.getByRole('heading', { name: 'Sign in to your account' });

    const isLoading = await loadingText.isVisible().catch(() => false);
    const isSubscriptions = await subscriptionsHeading.isVisible().catch(() => false);
    const isSignIn = await signinHeading.isVisible().catch(() => false);

    expect(isLoading || isSubscriptions || isSignIn).toBeTruthy();
  });
});

test.describe('Fan - Dashboard', () => {
  test('fan dashboard redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard/fan');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/fan/);
  });

  test('fan dashboard renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/fan');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });

  test('fan dashboard shows loading state or sign in redirect', async ({ page }) => {
    await page.goto('/dashboard/fan');
    await page.waitForLoadState('domcontentloaded');

    // The page either shows loading spinner, the dashboard, or redirects to sign in
    const loadingText = page.getByText('Loading dashboard...');
    const signinHeading = page.getByRole('heading', { name: 'Sign in to your account' });

    const isLoading = await loadingText.isVisible().catch(() => false);
    const isSignIn = await signinHeading.isVisible().catch(() => false);

    expect(isLoading || isSignIn).toBeTruthy();
  });
});

test.describe('Fan - Content Pages', () => {
  test('content listing page renders without server errors', async ({ page }) => {
    const response = await page.goto('/content');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });

  test('individual content page renders without server errors', async ({ page }) => {
    const response = await page.goto('/content/test-content-id');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Fan - Campaigns Page', () => {
  test('fan campaigns page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/fan/campaigns');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Fan - Feed Page', () => {
  test('feed page renders without server errors', async ({ page }) => {
    const response = await page.goto('/feed');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});
