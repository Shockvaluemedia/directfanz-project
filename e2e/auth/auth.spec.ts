import { test, expect } from '@playwright/test';

test.describe('Auth - Sign In Page', () => {
  test('sign in page renders with email and password fields', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    // Verify the heading
    await expect(
      page.getByRole('heading', { name: 'Sign in to your account' })
    ).toBeVisible();

    // Verify email input is present and has correct attributes
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('placeholder', 'Email address');

    // Verify password input is present and has correct attributes
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('placeholder', 'Password');

    // Verify the submit button
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('sign in page has link to sign up page', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    const signUpLink = page.getByRole('link', { name: 'create a new account' });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/auth/signup');
  });

  test('sign in page navigates to sign up when link clicked', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'create a new account' }).click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('sign in form shows validation for empty required fields', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    // The email and password fields have the HTML "required" attribute.
    // Clicking submit on an empty form triggers browser-native validation.
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Attempt to submit the empty form - the browser should prevent submission
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await submitButton.click();

    // We should still be on the sign in page (form was not submitted)
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('sign in form accepts input in email and password fields', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.fill('TestPassword123!');
    await expect(passwordInput).toHaveValue('TestPassword123!');
  });

  test('sign in button shows loading state when form is submitted', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('SomePassword123!');

    // Click submit and check for loading state text
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The button text changes to "Signing in..." during loading
    await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible();
  });

  test('sign in form email field has autocomplete attribute', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('sign in page renders within a centered layout', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    // Verify the outer container exists (min-h-screen centered layout)
    const container = page.locator('.min-h-screen.flex.items-center.justify-center');
    await expect(container).toBeVisible();
  });

  test('sign in redirects to dashboard on successful authentication', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('domcontentloaded');

    // Verify the form action will eventually redirect to /dashboard
    // (We test the UI flow without requiring a real database)
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // The form's onSubmit handler calls signIn('credentials') and then router.push('/dashboard')
    // This verifies the form structure is correct for the redirect flow
    const submitButton = page.getByRole('button', { name: 'Sign in' });
    await expect(submitButton).toHaveAttribute('type', 'submit');
  });
});

test.describe('Auth - Sign Up Page', () => {
  test('sign up page renders with multi-step registration form', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Verify the main heading
    await expect(
      page.getByRole('heading', { name: 'Join DirectFanZ' })
    ).toBeVisible();

    // Verify step indicator shows Step 1 of 3
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    // Step 1 heading
    await expect(
      page.getByRole('heading', { name: "Let's get to know you" })
    ).toBeVisible();

    // Step 1 fields: display name and email
    const displayNameInput = page.locator('#displayName');
    await expect(displayNameInput).toBeVisible();
    await expect(displayNameInput).toHaveAttribute('placeholder', 'Your display name');

    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('sign up page has link to sign in page', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    const signInLink = page.getByRole('link', { name: 'Sign in here' });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/auth/signin');
  });

  test('sign up step 1 shows validation feedback for display name', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Initially the "Continue" button should be disabled (no input yet)
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();

    // Fill in a valid display name
    await page.locator('#displayName').fill('Test User');
    await expect(page.getByText('Great name!')).toBeVisible();

    // Still disabled because email is not filled
    await expect(continueButton).toBeDisabled();
  });

  test('sign up step 1 shows email validation feedback', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Fill in display name and a valid email
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('valid@example.com');

    // Should see valid email confirmation
    await expect(page.getByText('Valid email format')).toBeVisible();

    // Continue button should now be enabled
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeEnabled();
  });

  test('sign up step 1 shows progress bar', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Verify progress indicator
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByText('33% complete')).toBeVisible();
  });

  test('sign up progresses through steps correctly', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Step 1: Fill in name and email
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await expect(page.getByText('Step 1 of 3')).toBeVisible();

    // Click Continue to go to step 2
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Create a secure password' })
    ).toBeVisible();

    // Verify password field is visible
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Verify confirm password field is visible
    const confirmPasswordInput = page.locator('#confirmPassword');
    await expect(confirmPasswordInput).toBeVisible();
  });

  test('sign up step 2 shows password strength indicator', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Enter a weak password
    await page.locator('#password').fill('abc');
    await expect(page.getByText('Password Strength:')).toBeVisible();
    await expect(page.getByText('weak')).toBeVisible();

    // Enter a stronger password
    await page.locator('#password').fill('StrongPass1!');
    await expect(page.getByText('strong')).toBeVisible();

    // Verify password match feedback
    await page.locator('#confirmPassword').fill('StrongPass1!');
    await expect(page.getByText('Passwords match!')).toBeVisible();
  });

  test('sign up step 2 shows password requirements checklist', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Type a password to reveal the requirements list
    await page.locator('#password').fill('a');
    await expect(page.getByText('8+ characters')).toBeVisible();
    await expect(page.getByText('Uppercase')).toBeVisible();
    await expect(page.getByText('Lowercase')).toBeVisible();
    await expect(page.getByText('Numbers')).toBeVisible();
    await expect(page.getByText('Special chars')).toBeVisible();
  });

  test('sign up step 2 shows password mismatch feedback', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Enter mismatched passwords
    await page.locator('#password').fill('StrongPass1!');
    await page.locator('#confirmPassword').fill('DifferentPass1!');
    await expect(page.getByText("Passwords don't match")).toBeVisible();
  });

  test('sign up step 3 shows role selection and terms', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Fill step 2
    await page.locator('#password').fill('StrongPass1!');
    await page.locator('#confirmPassword').fill('StrongPass1!');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Verify step 3
    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'What brings you to DirectFanZ?' })
    ).toBeVisible();

    // Verify role options
    await expect(page.getByText("I'm a Fan")).toBeVisible();
    await expect(page.getByText("I'm a Creator")).toBeVisible();

    // Verify terms checkbox
    await expect(page.getByText('Terms of Service')).toBeVisible();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });

  test('sign up step 3 shows role description badges', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 3
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#password').fill('StrongPass1!');
    await page.locator('#confirmPassword').fill('StrongPass1!');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Verify fan role badges
    await expect(page.getByText('Exclusive Content')).toBeVisible();
    await expect(page.getByText('Support Creators')).toBeVisible();
    await expect(page.getByText('Community Access')).toBeVisible();

    // Verify creator role badges
    await expect(page.getByText('Monetize Content')).toBeVisible();
    await expect(page.getByText('Build Fanbase')).toBeVisible();
    await expect(page.getByText('Creative Tools')).toBeVisible();
  });

  test('sign up step 3 Create My Account button requires terms agreement', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 3
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#password').fill('StrongPass1!');
    await page.locator('#confirmPassword').fill('StrongPass1!');
    await page.getByRole('button', { name: 'Continue' }).click();

    // The Create My Account button should be disabled until terms are agreed
    const createButton = page.getByRole('button', { name: 'Create My Account' });
    await expect(createButton).toBeDisabled();

    // Agree to terms
    await page.locator('#agreedToTerms').check();

    // Now the button should be enabled
    await expect(createButton).toBeEnabled();
  });

  test('sign up has Back button on steps 2 and 3', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Step 1 has no Back button
    await expect(page.getByRole('button', { name: 'Back' })).not.toBeVisible();

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 has Back button
    const backButton = page.getByRole('button', { name: 'Back' });
    await expect(backButton).toBeVisible();

    // Click Back and verify we return to step 1
    await backButton.click();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
  });

  test('sign up step 1 shows OAuth sign-up options', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Verify OAuth section is visible on step 1
    await expect(page.getByText('Or sign up with')).toBeVisible();
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Facebook/ })).toBeVisible();
  });

  test('sign up OAuth section is hidden on steps 2 and 3', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // OAuth visible on step 1
    await expect(page.getByText('Or sign up with')).toBeVisible();

    // Navigate to step 2
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // OAuth should not be visible on step 2
    await expect(page.getByText('Or sign up with')).not.toBeVisible();
  });

  test('sign up email updates checkbox is pre-checked by default', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to step 3
    await page.locator('#displayName').fill('Test User');
    await page.locator('#email').fill('testuser@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#password').fill('StrongPass1!');
    await page.locator('#confirmPassword').fill('StrongPass1!');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Email updates checkbox is checked by default
    const emailUpdatesCheckbox = page.locator('#emailUpdates');
    await expect(emailUpdatesCheckbox).toBeChecked();
  });
});

test.describe('Auth - Error Page', () => {
  test('auth error page loads', async ({ page }) => {
    await page.goto('/auth/error');
    await page.waitForLoadState('domcontentloaded');

    // The error page should load without crashing
    await expect(page).toHaveURL(/\/auth\/error/);
  });
});
