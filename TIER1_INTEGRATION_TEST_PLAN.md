# Tier 1 Features - Integration Test Plan

## Overview
This document provides a comprehensive test plan for the three Tier 1 features implemented:
1. Artist Setup Wizard
2. Stripe Onboarding Flow
3. Free Trial System

**Test Environment Requirements:**
- Local development environment with database seeded
- Stripe test mode credentials configured
- Test artist and fan accounts created
- Valid payment method for Stripe testing

---

## Feature #1: Artist Setup Wizard

### Database Tests

#### Test 1.1: Onboarding Progress Record Creation
**Goal:** Verify that onboarding_progress records are created correctly

**Steps:**
1. Create new artist account (role: ARTIST)
2. Authenticate as the artist
3. Call `GET /api/artist/onboarding/progress`
4. Verify response contains:
   - `progress` object with `userId`, `completionPercentage: 0`
   - `steps` array with 5 items (profile, stripe, tier, content, share)
   - `isComplete: false`
   - `isDismissed: false`

**Expected Result:**
- Record created in `onboarding_progress` table
- All completion flags set to `false`
- `completionPercentage` = 0

#### Test 1.2: Progress Auto-Detection
**Goal:** Verify wizard auto-detects completed steps

**Steps:**
1. As artist, upload avatar and add bio via profile API
2. Call `GET /api/artist/onboarding/progress`
3. Verify `profileComplete: true` in response
4. Create a tier via tiers API
5. Call `GET /api/artist/onboarding/progress` again
6. Verify `firstTierCreated: true`

**Expected Result:**
- Progress percentage increases (20% for profile, 25% for tier)
- Database reflects updated completion status

#### Test 1.3: Weighted Completion Calculation
**Goal:** Verify weighted progress calculation is correct

**Test Cases:**
- Profile only: 20%
- Stripe only: 30%
- Profile + Stripe: 50%
- Profile + Stripe + Tier: 75%
- All steps: 100%

**Steps:**
For each test case:
1. Reset onboarding (`POST /api/artist/onboarding/reset`)
2. Complete specified steps
3. Call `GET /api/artist/onboarding/progress`
4. Assert `completionPercentage` matches expected value

### API Tests

#### Test 2.1: GET /api/artist/onboarding/progress
**Authentication:**
- ❌ Unauthenticated → 401 Unauthorized
- ❌ Fan role → 403 Forbidden
- ✅ Artist role → 200 OK with progress data

**Response Schema Validation:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "id": "string",
      "userId": "string",
      "profileComplete": "boolean",
      "stripeConnected": "boolean",
      "firstTierCreated": "boolean",
      "firstContentUploaded": "boolean",
      "profileShared": "boolean",
      "completionPercentage": "number (0-100)",
      "currentStep": "string | null",
      "dismissedAt": "datetime | null",
      "completedAt": "datetime | null"
    },
    "steps": [/* array of 5 steps */],
    "nextStep": {/* first incomplete step */},
    "isComplete": "boolean",
    "isDismissed": "boolean"
  }
}
```

#### Test 2.2: PUT /api/artist/onboarding/progress
**Request:**
```json
{
  "step": "profile",
  "completed": true
}
```

**Validations:**
- ❌ Missing `step` field → 400 Bad Request
- ❌ Invalid step ID → 400 Bad Request
- ❌ Missing `completed` field → 400 Bad Request
- ✅ Valid request → 200 OK with updated progress

**Side Effects:**
- Database record updated
- `completionPercentage` recalculated
- `completedAt` set if 100%

#### Test 2.3: POST /api/artist/onboarding/dismiss
**Goal:** Verify wizard can be dismissed

**Steps:**
1. Call `POST /api/artist/onboarding/dismiss`
2. Verify `dismissedAt` timestamp is set
3. Call `GET /api/artist/onboarding/progress`
4. Verify `isDismissed: true`

**Expected Behavior:**
- Wizard should hide in UI but remain accessible
- Progress still tracked in background

#### Test 2.4: POST /api/artist/onboarding/reset
**Goal:** Verify wizard can be reset (for testing/debugging)

**Steps:**
1. Complete several steps
2. Call `POST /api/artist/onboarding/reset`
3. Verify all flags reset to `false`
4. Verify `completionPercentage: 0`
5. Verify `dismissedAt` and `completedAt` are null

### UI Component Tests

#### Test 3.1: ArtistSetupWizard Visibility
**Scenarios:**

| Scenario | completionPercentage | dismissedAt | Expected |
|----------|---------------------|-------------|----------|
| New artist | 0 | null | Show full wizard |
| Dismissed | 0 | set | Show collapsed banner |
| In progress | 50 | null | Show full wizard |
| Complete | 100 | null | Show success message |
| Complete & dismissed | 100 | set | Hidden |

#### Test 3.2: SetupChecklist Interaction
**Goal:** Test expandable step details

**Steps:**
1. Render SetupChecklist component
2. Click on tier creation step
3. Verify templates are shown (Supporter $5, Super Fan $10, VIP $25)
4. Click on content upload step
5. Verify suggestions are shown (welcome video, exclusive track, etc.)

#### Test 3.3: SetupProgressBar Animation
**Goal:** Test progress bar displays correctly

**Test Cases:**
- 0% → No milestone message
- 50% → "Halfway there! 🎉"
- 80% → "Almost done! 💪"
- 100% → "Setup complete! 🚀"

**Visual Tests:**
- Progress bar gradient animates smoothly
- Percentage text updates correctly
- Shimmer effect visible on incomplete progress

---

## Feature #2: Stripe Onboarding Flow

### Integration Tests

#### Test 4.1: POST /api/artist/stripe/connect - New Account
**Goal:** Create new Stripe Express account

**Steps:**
1. Authenticate as artist without Stripe account
2. Call `POST /api/artist/stripe/connect`
3. Verify response:
   ```json
   {
     "success": true,
     "url": "https://connect.stripe.com/setup/...",
     "accountId": "acct_..."
   }
   ```
4. Check database:
   - `artists.stripeAccountId` updated
   - `artists.isStripeOnboarded` = false (until onboarding complete)

**Mock Stripe Calls:**
- `stripe.accounts.create()` → Returns account object
- `stripe.accountLinks.create()` → Returns onboarding URL

#### Test 4.2: POST /api/artist/stripe/connect - Existing Incomplete Account
**Goal:** Resume incomplete onboarding

**Steps:**
1. Create artist with existing `stripeAccountId` but `isStripeOnboarded: false`
2. Call `POST /api/artist/stripe/connect`
3. Verify no new account is created
4. Verify fresh onboarding link is returned

#### Test 4.3: GET /api/artist/stripe/connect - Account Status
**Goal:** Check Stripe account capabilities

**Steps:**
1. Call `GET /api/artist/stripe/connect`
2. Verify response:
   ```json
   {
     "success": true,
     "connected": true|false,
     "accountId": "acct_...",
     "chargesEnabled": true|false,
     "payoutsEnabled": true|false,
     "requiresAction": true|false
   }
   ```

**Test Cases:**
- No Stripe account → `connected: false`
- Incomplete onboarding → `connected: true, requiresAction: true`
- Complete onboarding → `connected: true, chargesEnabled: true, payoutsEnabled: true`

#### Test 4.4: Stripe Success Flow
**Goal:** Complete onboarding successfully

**Steps:**
1. Navigate to `/dashboard/artist/stripe/success`
2. Mock Stripe webhook: `account.updated` with `charges_enabled: true`
3. Verify:
   - `onboarding_progress.stripeConnected` updated to `true`
   - Page shows success message with next steps
   - Auto-redirect to dashboard after 5 seconds

#### Test 4.5: Stripe Refresh Flow
**Goal:** Handle expired onboarding links

**Steps:**
1. Navigate to `/dashboard/artist/stripe/refresh`
2. Verify page calls `/api/artist/stripe/connect`
3. Verify redirect to new Stripe onboarding URL

### UI Component Tests

#### Test 5.1: StripeOnboardingModal - Blocking Mode
**Goal:** Test modal cannot be closed for required actions

**Setup:**
```tsx
<StripeOnboardingModal
  isOpen={true}
  triggerSource="tier_creation"
  blocking={true}
/>
```

**Assertions:**
- Close button is hidden
- Clicking overlay does not close modal
- Warning banner is displayed
- "Connect Stripe to Continue" button is prominent

#### Test 5.2: StripeOnboardingModal - Non-Blocking Mode
**Goal:** Test modal can be dismissed

**Setup:**
```tsx
<StripeOnboardingModal
  isOpen={true}
  triggerSource="payout_settings"
  blocking={false}
/>
```

**Assertions:**
- Close button is visible
- Clicking overlay closes modal
- No warning banner shown
- "Set Up Payouts" button is prominent

#### Test 5.3: StripeOnboardingModal - Loading State
**Goal:** Test button shows loading during API call

**Steps:**
1. Click "Connect Stripe" button
2. Verify button shows "Connecting..." with spinner
3. Verify button is disabled during load

#### Test 5.4: StripeOnboardingModal - Error Handling
**Goal:** Test error message display

**Steps:**
1. Mock `/api/artist/stripe/connect` to return error
2. Click "Connect Stripe" button
3. Verify error message is displayed in red banner
4. Verify button returns to enabled state

---

## Feature #3: Free Trial System

### Database Tests

#### Test 6.1: Tier Schema - Trial Fields
**Goal:** Verify tier trial configuration

**Setup:**
```typescript
await prisma.tiers.create({
  data: {
    id: 'tier_123',
    artistId: 'artist_1',
    name: 'Super Fan',
    description: 'All content + early access',
    minimumPrice: 10.00,
    allowFreeTrial: true,
    trialDays: 7,
    trialDescription: 'Try free for 7 days, cancel anytime',
    stripePriceId: 'price_...'
  }
});
```

**Assertions:**
- Record created successfully
- `allowFreeTrial` defaults to `true`
- `trialDays` defaults to `7`

#### Test 6.2: Subscription Schema - Trial Tracking
**Goal:** Verify subscription trial fields

**Required Fields:**
- `isTrialing: true`
- `trialStartDate: DateTime`
- `trialEndDate: DateTime`
- `convertedFromTrial: false`
- `status: 'TRIALING'`

### API Integration Tests

#### Test 7.1: POST /api/subscriptions/create - With Trial
**Goal:** Create subscription with free trial

**Request:**
```json
{
  "tierId": "tier_123",
  "paymentMethodId": "pm_card_visa"
}
```

**Pre-conditions:**
- Tier has `allowFreeTrial: true`, `trialDays: 7`
- Fan has no existing subscription to this artist

**Steps:**
1. Call `POST /api/subscriptions/create`
2. Verify Stripe subscription created with `trial_period_days: 7`
3. Verify database subscription:
   ```typescript
   {
     status: 'TRIALING',
     isTrialing: true,
     trialStartDate: new Date(),
     trialEndDate: new Date() + 7 days,
     convertedFromTrial: false
   }
   ```
4. Verify `tiers.subscriberCount` incremented
5. Verify welcome notification sent mentioning trial

**Stripe Mock Assertions:**
```typescript
expect(stripe.subscriptions.create).toHaveBeenCalledWith({
  customer: 'cus_...',
  items: [{ price: 'price_...' }],
  trial_period_days: 7,
  payment_behavior: 'default_incomplete',
  application_fee_percent: 20,
  transfer_data: { destination: 'acct_artist' },
  metadata: { fanId: '...', artistId: '...', tierId: '...' }
});
```

#### Test 7.2: POST /api/subscriptions/create - Without Trial
**Goal:** Create subscription without trial when disabled

**Pre-conditions:**
- Tier has `allowFreeTrial: false`

**Steps:**
1. Call `POST /api/subscriptions/create`
2. Verify Stripe subscription created WITHOUT `trial_period_days`
3. Verify database subscription:
   ```typescript
   {
     status: 'ACTIVE',
     isTrialing: false,
     trialStartDate: null,
     trialEndDate: null,
     convertedFromTrial: false
   }
   ```

#### Test 7.3: Stripe Customer Creation/Retrieval
**Goal:** Test customer management in subscription flow

**Scenario 1: New Customer**
- Fan has no `stripeCustomerId`
- Call creates new Stripe customer
- `users.stripeCustomerId` is updated

**Scenario 2: Existing Customer**
- Fan has `stripeCustomerId: 'cus_...'`
- Call reuses existing customer
- No duplicate customer created

#### Test 7.4: Stripe Price Creation/Retrieval
**Goal:** Test price management per tier

**Scenario 1: New Price**
- Tier has no `stripePriceId`
- Call creates new Stripe price with `unit_amount: tier.minimumPrice * 100`
- `tiers.stripePriceId` is updated

**Scenario 2: Existing Price**
- Tier has `stripePriceId: 'price_...'`
- Call reuses existing price
- No duplicate price created

#### Test 7.5: Trial End Conversion (Webhook)
**Goal:** Test subscription conversion after trial

**Webhook Event:** `customer.subscription.updated`
**Payload:**
```json
{
  "status": "active",
  "trial_end": 1234567890,
  "metadata": { "fanId": "...", "artistId": "...", "tierId": "..." }
}
```

**Expected Actions:**
1. Update subscription:
   ```typescript
   {
     status: 'ACTIVE',
     isTrialing: false,
     convertedFromTrial: true
   }
   ```
2. Send conversion notification to artist
3. Charge fan's payment method

**Note:** Webhook handler needs to be implemented

#### Test 7.6: Trial Cancellation
**Goal:** Test subscription cancellation during trial

**Steps:**
1. Fan cancels subscription while `isTrialing: true`
2. Verify no charge is made
3. Verify access revoked immediately
4. Verify subscription status set to `CANCELED`

### Edge Case Tests

#### Test 8.1: Duplicate Subscription Prevention
**Goal:** Prevent fan from subscribing to same artist twice

**Steps:**
1. Create active subscription for fan → artist
2. Attempt to create another subscription to same artist
3. Verify API returns 400 error: "Already subscribed"

#### Test 8.2: Trial Abuse Prevention
**Goal:** Prevent fan from starting multiple trials to same artist

**Implementation Needed:**
- Track `convertedFromTrial` flag
- Check if fan had previous subscription (even cancelled)
- If previous subscription exists, don't allow trial again

**Test:**
1. Fan completes trial and cancels
2. Fan tries to subscribe again
3. Verify no trial offered (immediate charge)

#### Test 8.3: Artist Without Stripe
**Goal:** Prevent subscriptions to artists without Stripe connected

**Steps:**
1. Attempt to subscribe to artist with no `stripeAccountId`
2. Verify API returns 400 error: "Artist payouts not configured"

#### Test 8.4: Platform Fee Calculation
**Goal:** Verify correct fee split (20% platform, 80% artist)

**Test:**
- Tier price: $10.00
- Expected split: $2.00 platform, $8.00 artist
- Verify `application_fee_percent: 20` in Stripe call

---

## End-to-End User Journeys

### Journey 1: Complete Artist Onboarding

**Steps:**
1. Sign up as artist
2. See setup wizard at 0%
3. Upload profile photo and bio → 20%
4. Click "Connect Stripe" in wizard
5. Complete Stripe onboarding (test mode)
6. Return to app → 50%
7. Create first tier with trial enabled → 75%
8. Upload first content → 90%
9. Click "Get Share Link" → 100%
10. See success celebration in wizard

**Validation Points:**
- Each step updates progress immediately
- Stripe account is fully connected
- Can create tier only after Stripe connected
- All database records created correctly

### Journey 2: Fan Subscribes with Trial

**Steps:**
1. Sign up as fan
2. Browse to artist profile (with tier price $10, trial 7 days)
3. Click "Start 7-Day Free Trial"
4. Enter payment method (Stripe test card)
5. Confirm subscription
6. See "Trial Active" badge on artist page
7. Access exclusive content immediately
8. Check subscription details shows trial end date
9. Wait 7 days (or simulate with Stripe Clock)
10. Verify charge of $10 occurs
11. Verify status changes to "Active Subscriber"

**Validation Points:**
- No charge during trial period
- Full access granted during trial
- Trial end date calculated correctly
- Automatic conversion to paid subscription
- Email notification at trial end

### Journey 3: Fan Cancels During Trial

**Steps:**
1. Fan starts trial subscription
2. Access content for 3 days
3. Cancel subscription from settings
4. Verify immediate access revocation
5. Verify no charge occurred
6. Verify cannot start another trial to same artist

---

## Performance & Load Tests

### Test 9.1: Concurrent Onboarding Progress Checks
**Goal:** Verify API handles multiple simultaneous requests

**Load:**
- 100 concurrent requests to `GET /api/artist/onboarding/progress`
- From 100 different artist accounts

**Success Criteria:**
- All requests return 200 OK
- Response time < 500ms for p95
- No duplicate record creation
- Database connections handled properly

### Test 9.2: Stripe API Resilience
**Goal:** Test graceful handling of Stripe API failures

**Scenarios:**
- Stripe API timeout
- Stripe rate limit hit
- Invalid API key
- Network error

**Expected Behavior:**
- Return user-friendly error message
- Log error with context
- Do not leave partial database state
- Retry logic for transient errors

---

## Security Tests

### Test 10.1: Authorization Checks
**Endpoints to Test:**
- `/api/artist/onboarding/*` → Artist role only
- `/api/subscriptions/create` → Authenticated fans only
- `/api/artist/stripe/connect` → Artist role only

**Attack Vectors:**
- Unauthenticated requests → 401
- Fan accessing artist endpoints → 403
- Artist accessing other artist's data → 403

### Test 10.2: CSRF Protection
**Goal:** Verify CSRF tokens on state-changing requests

**Test:**
- All POST/PUT/DELETE requests require valid CSRF token
- Requests with missing/invalid token rejected

### Test 10.3: Input Validation
**Test Cases:**
- SQL injection in tier name/description
- XSS in trial description
- Invalid tierId formats
- Negative trial days
- Trial days > 365

---

## Testing Checklist

### Pre-Deployment Validation

- [ ] All API endpoints return correct HTTP status codes
- [ ] Database migrations run successfully
- [ ] Prisma schema validates without errors
- [ ] Type checking passes (excluding pre-existing errors)
- [ ] Stripe test mode credentials configured
- [ ] Environment variables documented

### Manual Testing

- [ ] Artist can complete full onboarding flow
- [ ] Stripe onboarding redirects work correctly
- [ ] Trial subscriptions create without errors
- [ ] Non-trial subscriptions create without errors
- [ ] Progress wizard displays correctly at all percentages
- [ ] Success/error messages show appropriately
- [ ] Mobile responsive design works

### Automated Testing

- [ ] Unit tests for progress calculation functions
- [ ] Integration tests for all API routes
- [ ] E2E tests for critical user journeys
- [ ] Stripe webhook simulation tests
- [ ] Database constraint tests

### Production Readiness

- [ ] Stripe live mode credentials added (when ready)
- [ ] Webhook endpoints registered with Stripe
- [ ] Trial reminder emails configured
- [ ] Analytics tracking added for onboarding funnel
- [ ] Error monitoring set up (Sentry/Datadog)
- [ ] Database indexes optimized
- [ ] API rate limiting configured

---

## Known Issues & Limitations

### Current Limitations

1. **Webhook Handlers Missing:**
   - `customer.subscription.updated` (trial → active conversion)
   - `customer.subscription.trial_will_end` (3-day reminder)
   - `payment_intent.payment_failed` (handle failed charges)

2. **UI Components Not Yet Created:**
   - Artist tier creation form with trial toggle
   - Fan subscription page showing trial badge
   - Trial countdown timer on fan dashboard
   - Trial cancellation flow

3. **Email Notifications:**
   - Welcome email template needed (with trial info)
   - Trial ending reminder email (3 days before)
   - Trial converted email (successful charge)
   - Trial cancelled email

4. **Analytics:**
   - Trial conversion rate tracking
   - Onboarding funnel drop-off points
   - Time to complete each onboarding step

### Future Enhancements

1. **Smart Trial Logic:**
   - A/B test different trial lengths (3, 7, 14 days)
   - Personalized trial length based on tier price
   - Trial extensions for at-risk cancellations

2. **Onboarding Improvements:**
   - Video tutorials for each step
   - Sample content templates
   - AI-powered profile suggestions

3. **Advanced Features:**
   - Trial-only tiers (no paid conversion)
   - Graduated trials (limited content access)
   - Referral program for trial conversions

---

## Appendix: Test Data

### Test Artist Accounts
```typescript
{
  id: 'artist_test_1',
  email: 'artist@test.com',
  role: 'ARTIST',
  displayName: 'Test Artist',
  avatar: 'https://example.com/avatar.jpg',
  bio: 'I am a test artist',
}
```

### Test Fan Accounts
```typescript
{
  id: 'fan_test_1',
  email: 'fan@test.com',
  role: 'FAN',
  displayName: 'Test Fan',
  stripeCustomerId: null, // Will be created during test
}
```

### Test Tier Configurations
```typescript
// Trial Enabled
{
  id: 'tier_trial',
  name: 'Super Fan (Trial)',
  minimumPrice: 10.00,
  allowFreeTrial: true,
  trialDays: 7,
  trialDescription: 'Try free for 7 days'
}

// Trial Disabled
{
  id: 'tier_no_trial',
  name: 'VIP (No Trial)',
  minimumPrice: 25.00,
  allowFreeTrial: false,
  trialDays: 0,
}
```

### Stripe Test Cards
```
4242 4242 4242 4242 - Successful payment
4000 0000 0000 9995 - Declined (insufficient funds)
4000 0000 0000 0341 - Charge succeeds, customer is immediately disputed as fraudulent
```

---

## Next Steps After Testing

Once all tests pass:

1. **Implement Remaining Features:**
   - Feature #4: Content Scheduler
   - Feature #5: Personalized Discovery Feed

2. **Create Missing Components:**
   - Trial toggle in tier creation form
   - Trial badge in subscription UI
   - Cancellation flow with trial awareness

3. **Set Up Webhooks:**
   - Implement handlers for trial events
   - Register endpoints with Stripe
   - Test webhook deliveries

4. **Launch Preparation:**
   - Switch to Stripe live mode
   - Set up production monitoring
   - Create user documentation
   - Train support team on new features
