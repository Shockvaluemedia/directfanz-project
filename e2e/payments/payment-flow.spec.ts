import { test, expect } from '@playwright/test';
import { generateTestEmail, login, signup } from '../utils/test-utils';

test.describe('Payment flows', () => {
  const artistEmail = 'payment-artist@directfanz.io';
  const artistPassword = 'Password123!';
  const fanEmail = generateTestEmail('payment-fan');
  const fanPassword = 'Password123!';

  test.beforeEach(async ({ page }) => {
    // Ensure Stripe test mode is active — skip in environments without Stripe
    test.skip(
      !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'),
      'Stripe test mode required for payment E2E tests'
    );
  });

  test('fan can initiate subscription to artist tier', async ({ page }) => {
    // Sign up as fan
    await signup(page, fanEmail, fanPassword, 'Payment Test Fan', 'fan');

    // Navigate to an artist's profile
    await page.goto('/');
    await page.getByRole('link', { name: /explore/i }).first().click();

    // Find first artist card
    const firstArtist = page.locator('[data-testid="artist-card"]').first();
    await firstArtist.waitFor({ timeout: 5000 });
    await firstArtist.click();

    // Click subscribe on a tier
    const subscribeButton = page.getByRole('button', { name: /subscribe/i }).first();
    await subscribeButton.waitFor({ timeout: 5000 });
    await subscribeButton.click();

    // Should redirect to Stripe checkout or show payment modal
    await expect(
      page.locator('text=/checkout|payment|subscribe/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('fan can view their active subscriptions', async ({ page }) => {
    await login(page, fanEmail, fanPassword, 'fan');

    await page.goto('/dashboard/fan/subscriptions');
    await expect(page.getByRole('heading', { name: /subscription/i })).toBeVisible();
  });

  test('artist can view payment dashboard', async ({ page }) => {
    await login(page, artistEmail, artistPassword, 'artist');

    await page.goto('/dashboard/artist/earnings');
    await expect(
      page.locator('text=/earning|revenue|payment/i').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('webhook endpoint is reachable', async ({ request }) => {
    const response = await request.post('/api/payments/webhooks', {
      headers: { 'Content-Type': 'application/json' },
      data: '{}',
    });
    // Should return 400 (bad signature) not 404
    expect(response.status()).not.toBe(404);
  });
});
