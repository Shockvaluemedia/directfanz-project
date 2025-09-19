import { test, expect } from '@playwright/test';
import { generateTestEmail, signup, login, logout } from '../utils/test-utils';

test.describe('Authentication flows', () => {
  test('should allow a user to sign up as a fan', async ({ page }) => {
    const testEmail = generateTestEmail();
    const testPassword = 'Password123!';
    const displayName = 'Test Fan';

    await page.goto('/auth/signup');

    // Fill in the signup form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="displayName"]', displayName);
    await page.selectOption('select[name="role"]', 'fan');

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL('/dashboard/fan');

    // Verify we're on the fan dashboard
    await expect(page.getByText('Fan Dashboard')).toBeVisible();
  });

  test('should allow a user to sign up as an artist', async ({ page }) => {
    const testEmail = generateTestEmail('artist');
    const testPassword = 'Password123!';
    const displayName = 'Test Artist';

    await page.goto('/auth/signup');

    // Fill in the signup form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="displayName"]', displayName);
    await page.selectOption('select[name="role"]', 'artist');

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL('/dashboard/artist');

    // Verify we're on the artist dashboard
    await expect(page.getByText('Artist Dashboard')).toBeVisible();
  });

  test('should show validation errors for invalid signup data', async ({ page }) => {
    await page.goto('/auth/signup');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByText('Display name is required')).toBeVisible();

    // Test invalid email format
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Invalid email address')).toBeVisible();

    // Test password too short
    await page.fill('input[name="email"]', 'valid@example.com');
    await page.fill('input[name="password"]', 'short');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should allow a user to sign in and sign out', async ({ page }) => {
    // First create a test user
    const testEmail = generateTestEmail('signin');
    const testPassword = 'Password123!';
    const displayName = 'Test User';

    // Sign up
    await signup(page, testEmail, testPassword, displayName, 'fan');

    // Sign out
    await logout(page);

    // Verify we're logged out
    await expect(page.getByText('Sign in')).toBeVisible();

    // Sign in again
    await login(page, testEmail, testPassword);

    // Verify we're logged in
    await expect(page.getByText('Fan Dashboard')).toBeVisible();
  });

  test('should show error for invalid login credentials', async ({ page }) => {
    await page.goto('/auth/signin');

    // Try to login with invalid credentials
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});
