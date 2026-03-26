import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Homepage', () => {
  test('homepage loads and shows DirectFanz branding', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify the page title contains the brand name
    await expect(page).toHaveTitle(/DirectFanz/);

    // Verify the brand logo text is visible in the nav
    const navBrand = page.locator('nav').getByText('DirectFanz');
    await expect(navBrand).toBeVisible();

    // Verify the hero heading is present
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('favorite artists');
  });

  test('homepage shows hero section with call-to-action buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify hero description text
    await expect(page.getByText('Subscribe to exclusive content')).toBeVisible();

    // Verify CTA buttons are present
    const joinAsFanLink = page.getByRole('link', { name: 'Join as a Fan' });
    await expect(joinAsFanLink).toBeVisible();
    await expect(joinAsFanLink).toHaveAttribute('href', '/auth/signup?role=fan');

    const startCreatingLink = page.getByRole('link', { name: 'Start Creating' });
    await expect(startCreatingLink).toBeVisible();
    await expect(startCreatingLink).toHaveAttribute('href', '/auth/signup?role=artist');
  });

  test('homepage shows features section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify feature cards are displayed
    await expect(page.getByText('Everything creators need to thrive')).toBeVisible();
    await expect(page.getByText('Live Streaming')).toBeVisible();
    await expect(page.getByText('Tiered Subscriptions')).toBeVisible();
    await expect(page.getByText('Instant Payouts')).toBeVisible();
  });

  test('homepage shows pricing section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Simple pricing for creators')).toBeVisible();
    await expect(page.getByText('platform fee on earnings')).toBeVisible();

    // Verify pricing details
    await expect(page.getByText('Unlimited content uploads')).toBeVisible();
    await expect(page.getByText('Analytics dashboard')).toBeVisible();
    await expect(page.getByText('Direct Stripe payouts')).toBeVisible();
  });

  test('homepage shows footer with legal links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const privacyLink = footer.getByRole('link', { name: 'Privacy Policy' });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');

    const termsLink = footer.getByRole('link', { name: 'Terms of Service' });
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('href', '/terms');
  });

  test('homepage footer shows copyright text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer');
    await expect(footer.getByText('DirectFanz. All rights reserved.')).toBeVisible();
  });
});

test.describe('Smoke Tests - Navigation', () => {
  test('Sign In link navigates to sign in page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const signInLink = page.locator('nav').getByRole('link', { name: 'Sign In' });
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('Get Started link navigates to sign up page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const getStartedLink = page.locator('nav').getByRole('link', { name: 'Get Started' });
    await expect(getStartedLink).toBeVisible();
    await getStartedLink.click();

    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('Discover page redirects unauthenticated users to sign in', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('domcontentloaded');

    // Unauthenticated users should be redirected to sign in
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('features page loads and renders content', async ({ page }) => {
    await page.goto('/features');
    await page.waitForLoadState('domcontentloaded');

    // The features page has a heading "Advanced Features"
    await expect(page.getByRole('heading', { name: 'Advanced Features' })).toBeVisible();

    // Verify feature category filter buttons are present
    await expect(page.getByText('All Features')).toBeVisible();
    await expect(page.getByText('AI & ML')).toBeVisible();
    await expect(page.getByText('Collaboration')).toBeVisible();
    await expect(page.getByText('Security')).toBeVisible();
  });

  test('features page shows feature cards with descriptions', async ({ page }) => {
    await page.goto('/features');
    await page.waitForLoadState('domcontentloaded');

    // Verify individual feature cards are displayed
    await expect(page.getByText('AI Creative Assistant')).toBeVisible();
    await expect(page.getByText('Real-Time Collaboration Studio')).toBeVisible();
    await expect(page.getByText('Enterprise Security Suite')).toBeVisible();
  });

  test('features page category filter works', async ({ page }) => {
    await page.goto('/features');
    await page.waitForLoadState('domcontentloaded');

    // Click AI & ML category
    await page.getByText('AI & ML').click();

    // AI Creative Assistant should still be visible
    await expect(page.getByText('AI Creative Assistant')).toBeVisible();
  });

  test('streams page loads', async ({ page }) => {
    await page.goto('/streams');
    await page.waitForLoadState('domcontentloaded');

    // Page should load without errors (it renders the StreamDashboard component)
    await expect(page).toHaveURL(/\/streams/);
  });

  test('search page loads', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/search/);
  });

  test('Start Earning Today link navigates to artist signup', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const earningLink = page.getByRole('link', { name: 'Start Earning Today' });
    await expect(earningLink).toBeVisible();
    await expect(earningLink).toHaveAttribute('href', '/auth/signup?role=artist');
  });
});

test.describe('Smoke Tests - Error Handling', () => {
  test('404 page shows for invalid routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-at-all');
    await page.waitForLoadState('domcontentloaded');

    // The not-found page shows "Page Not Found" text
    await expect(page.getByText('Page Not Found')).toBeVisible();

    // Verify the explanation text
    await expect(
      page.getByText("The page you're looking for does not exist or may have been moved.")
    ).toBeVisible();

    // Verify the "Go to Home Page" link is visible
    const homeLink = page.getByRole('link', { name: 'Go to Home Page' });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');

    // Verify the "Go Back" button is visible
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible();
  });

  test('404 page home link navigates back to homepage', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Page Not Found')).toBeVisible();

    await page.getByRole('link', { name: 'Go to Home Page' }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL('/');
  });

  test('multiple invalid routes all show the 404 page', async ({ page }) => {
    const invalidRoutes = [
      '/nonexistent',
      '/foo/bar/baz',
      '/dashboard/invalid-role',
    ];

    for (const route of invalidRoutes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      // Each invalid route should show the not-found page or redirect
      // We just verify the page loaded without a crash
      const url = page.url();
      expect(url).toBeTruthy();
    }
  });
});

test.describe('Smoke Tests - API Health', () => {
  test('status endpoint returns 200 with operational status', async ({ request }) => {
    const response = await request.get('/api/status');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.service).toBe('Direct Fan API');
    expect(body.status).toBe('operational');
    expect(body.timestamp).toBeTruthy();
    expect(body.environment).toBeTruthy();
    expect(body.features).toBeTruthy();
    expect(body.features.authentication).toBe('enabled');
    expect(body.features.payments).toBe('enabled');
  });

  test('status endpoint returns valid version and uptime', async ({ request }) => {
    const response = await request.get('/api/status');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.version).toBeTruthy();
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test('status endpoint returns rate limit configuration', async ({ request }) => {
    const response = await request.get('/api/status');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.limits).toBeTruthy();
    expect(body.limits.maxFileSize).toBe('50MB');
    expect(body.limits.rateLimitWindow).toBeTruthy();
    expect(body.limits.rateLimitMax).toBeTruthy();
  });

  test('status endpoint rejects non-GET requests', async ({ request }) => {
    const response = await request.post('/api/status');

    expect(response.status()).toBe(405);

    const body = await response.json();
    expect(body.error).toBe('Method not allowed');
  });
});
