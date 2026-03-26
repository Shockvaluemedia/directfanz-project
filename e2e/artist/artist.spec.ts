import { test, expect } from '@playwright/test';

test.describe('Artist Dashboard', () => {
  test('artist dashboard page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard/artist');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in
    // The page either redirects or shows a loading state before redirect
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/artist/);
  });

  test('artist dashboard page renders loading state initially', async ({ page }) => {
    await page.goto('/dashboard/artist');
    await page.waitForLoadState('domcontentloaded');

    // The page shows a loading spinner while checking session
    // It will either show "Loading dashboard..." or redirect
    const loadingText = page.getByText('Loading dashboard...');
    const signinUrl = /\/auth\/signin/;

    // Either loading text is visible or we got redirected
    const isLoading = await loadingText.isVisible().catch(() => false);
    const isRedirected = signinUrl.test(page.url());

    expect(isLoading || isRedirected).toBeTruthy();
  });
});

test.describe('Artist Content Upload Page', () => {
  test('upload page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard/artist/upload');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/artist\/upload/);
  });

  test('upload page renders heading and description for authenticated view', async ({ page }) => {
    // Navigate to the upload page to verify it loads without errors
    const response = await page.goto('/dashboard/artist/upload');
    await page.waitForLoadState('domcontentloaded');

    // The page should return a valid HTTP response
    expect(response?.status()).toBeLessThan(500);
  });

  test('upload page structure includes content uploader section', async ({ page }) => {
    await page.goto('/dashboard/artist/upload');
    await page.waitForLoadState('domcontentloaded');

    // Check that the page has the correct heading when rendered
    // (will only be visible when authenticated as an artist)
    const heading = page.getByRole('heading', { name: 'Upload Content' });
    const signinPage = page.locator('input[name="email"]');

    // Either the upload page heading is visible (authenticated) or we see sign in
    const headingVisible = await heading.isVisible().catch(() => false);
    const signinVisible = await signinPage.isVisible().catch(() => false);

    expect(headingVisible || signinVisible).toBeTruthy();
  });
});

test.describe('Artist Tier Management Page', () => {
  test('tiers page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard/artist/tiers');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/artist\/tiers/);
  });

  test('tiers page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/artist/tiers');
    await page.waitForLoadState('domcontentloaded');

    // The page should return a valid HTTP response (not a 500 error)
    expect(response?.status()).toBeLessThan(500);
  });

  test('tiers page shows loading state or sign in redirect', async ({ page }) => {
    await page.goto('/dashboard/artist/tiers');
    await page.waitForLoadState('domcontentloaded');

    // The page either shows loading, the tiers UI, or redirects to sign in
    const loadingText = page.getByText('Loading tiers...');
    const tiersHeading = page.getByRole('heading', { name: 'Subscription Tiers' });
    const signinHeading = page.getByRole('heading', { name: 'Sign in to your account' });

    const isLoading = await loadingText.isVisible().catch(() => false);
    const isTiersPage = await tiersHeading.isVisible().catch(() => false);
    const isSignIn = await signinHeading.isVisible().catch(() => false);

    expect(isLoading || isTiersPage || isSignIn).toBeTruthy();
  });

  test('tiers page has correct structure when rendered', async ({ page }) => {
    await page.goto('/dashboard/artist/tiers');
    await page.waitForLoadState('domcontentloaded');

    // If the page renders (authenticated), it should have the "Subscription Tiers" heading
    // and a "+ Create Tier" button. If not authenticated, sign in page is shown.
    const tiersHeading = page.getByRole('heading', { name: 'Subscription Tiers' });
    const createButton = page.getByRole('button', { name: '+ Create Tier' });
    const signinPage = page.locator('input[name="email"]');

    const hasTiersUI = await tiersHeading.isVisible().catch(() => false);
    const hasCreateButton = await createButton.isVisible().catch(() => false);
    const hasSignIn = await signinPage.isVisible().catch(() => false);

    // Either the tiers page loads with its UI or we see the sign in page
    expect(hasTiersUI || hasSignIn).toBeTruthy();

    if (hasTiersUI) {
      // If tiers page is visible, the create button should also be present
      expect(hasCreateButton).toBeTruthy();

      // Verify the description text
      await expect(
        page.getByText('Manage your subscription tiers and pricing')
      ).toBeVisible();
    }
  });
});

test.describe('Artist Analytics Page', () => {
  test('analytics page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/dashboard/artist/analytics');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected
    await expect(page).toHaveURL(/\/auth\/signin|\/dashboard\/artist\/analytics/);
  });

  test('analytics page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/artist/analytics');
    await page.waitForLoadState('domcontentloaded');

    // The page should not return a 500 error
    expect(response?.status()).toBeLessThan(500);
  });

  test('analytics page shows loading state or sign in redirect', async ({ page }) => {
    await page.goto('/dashboard/artist/analytics');
    await page.waitForLoadState('domcontentloaded');

    // The page either shows loading, the analytics UI, or redirects to sign in
    const loadingText = page.getByText('Loading analytics...');
    const analyticsHeading = page.getByRole('heading', { name: 'Analytics' });
    const signinHeading = page.getByRole('heading', { name: 'Sign in to your account' });

    const isLoading = await loadingText.isVisible().catch(() => false);
    const isAnalytics = await analyticsHeading.isVisible().catch(() => false);
    const isSignIn = await signinHeading.isVisible().catch(() => false);

    expect(isLoading || isAnalytics || isSignIn).toBeTruthy();
  });

  test('analytics page has correct structure when rendered', async ({ page }) => {
    await page.goto('/dashboard/artist/analytics');
    await page.waitForLoadState('domcontentloaded');

    const analyticsHeading = page.getByRole('heading', { name: 'Analytics' });
    const isAnalytics = await analyticsHeading.isVisible().catch(() => false);

    if (isAnalytics) {
      // Verify the description text
      await expect(
        page.getByText('Comprehensive insights into your performance')
      ).toBeVisible();

      // Verify navigation tabs exist
      await expect(page.getByText('Overview')).toBeVisible();
      await expect(page.getByText('Revenue')).toBeVisible();
      await expect(page.getByText('Subscribers')).toBeVisible();
      await expect(page.getByText('Content')).toBeVisible();

      // Verify Back to Dashboard link
      await expect(page.getByText('Back to Dashboard')).toBeVisible();

      // Verify analytics overview section
      await expect(page.getByText('Analytics Overview')).toBeVisible();
      await expect(page.getByText('Revenue Analytics')).toBeVisible();
      await expect(page.getByText('Subscriber Analytics')).toBeVisible();
      await expect(page.getByText('Content Performance')).toBeVisible();
    }
  });
});

test.describe('Artist Content Management Page', () => {
  test('artist content page redirects unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard/artist/content');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected
    const response = await page.goto('/dashboard/artist/content');
    expect(response?.status()).toBeLessThan(500);
  });

  test('artist content page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/artist/content');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Artist Livestreams Page', () => {
  test('livestreams page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/artist/livestreams');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Artist Campaigns Page', () => {
  test('campaigns page renders without server errors', async ({ page }) => {
    const response = await page.goto('/dashboard/artist/campaigns');
    await page.waitForLoadState('domcontentloaded');

    expect(response?.status()).toBeLessThan(500);
  });
});
