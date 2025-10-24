# DirectFanz API Documentation
## Tier 1 Features - New Endpoints

This document describes all new API endpoints added as part of the Tier 1 priority features implementation.

---

## Table of Contents

1. [Artist Onboarding](#artist-onboarding)
2. [Stripe Integration](#stripe-integration)
3. [Subscriptions & Trials](#subscriptions--trials)
4. [Content Scheduling](#content-scheduling)
5. [Discovery & Recommendations](#discovery--recommendations)
6. [Analytics & Tracking](#analytics--tracking)
7. [Admin Tools](#admin-tools)
8. [Webhooks](#webhooks)

---

## Artist Onboarding

### GET /api/artist/onboarding/progress
Returns the current onboarding progress for the authenticated artist.

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "id": "prog_123",
      "userId": "user_456",
      "profileComplete": true,
      "stripeConnected": false,
      "firstTierCreated": false,
      "firstContentUploaded": false,
      "profileShared": false,
      "completionPercentage": 20,
      "currentStep": "stripe",
      "dismissedAt": null,
      "completedAt": null
    },
    "steps": [...],
    "nextStep": {...},
    "isComplete": false,
    "isDismissed": false
  }
}
```

### PUT /api/artist/onboarding/progress
Updates completion status for a specific onboarding step.

**Authentication:** Required (Artist role)

**Request Body:**
```json
{
  "step": "profile",
  "completed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prog_123",
    "completionPercentage": 40,
    ...
  }
}
```

### POST /api/artist/onboarding/dismiss
Dismisses the onboarding wizard (but keeps it accessible).

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

### POST /api/artist/onboarding/reset
Resets the onboarding progress (for testing or re-onboarding).

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

## Stripe Integration

### POST /api/artist/stripe/connect
Creates a Stripe Connect Express account and returns onboarding URL.

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "url": "https://connect.stripe.com/setup/...",
  "accountId": "acct_..."
}
```

### GET /api/artist/stripe/connect
Returns the current Stripe account status.

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "connected": true,
  "accountId": "acct_...",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requiresAction": false
}
```

---

## Subscriptions & Trials

### POST /api/subscriptions/create
Creates a new subscription with optional free trial.

**Authentication:** Required (Fan role)

**Request Body:**
```json
{
  "tierId": "tier_123",
  "paymentMethodId": "pm_card_visa"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "status": "TRIALING",
      "isTrialing": true,
      "trialStartDate": "2024-01-01T00:00:00Z",
      "trialEndDate": "2024-01-08T00:00:00Z",
      "amount": 10.00,
      ...
    },
    "clientSecret": "pi_..."
  }
}
```

**Trial Behavior:**
- If `tier.allowFreeTrial` is `true`, subscription starts in trial
- Trial duration is `tier.trialDays` (default 7)
- No charge during trial period
- Auto-converts to paid after trial ends
- Fan can cancel anytime during trial

---

## Content Scheduling

### POST /api/artist/content/schedule
Schedules content for future publication.

**Authentication:** Required (Artist role)

**Request Body:**
```json
{
  "contentId": "content_123",
  "scheduledFor": "2024-12-25T12:00:00Z",
  "timezone": "America/Los_Angeles"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": {...},
    "schedule": {
      "id": "sched_123",
      "scheduledFor": "2024-12-25T12:00:00Z",
      "timezone": "America/Los_Angeles",
      "published": false
    }
  }
}
```

**Validation:**
- `scheduledFor` must be in the future
- Content must not already be published
- Content must belong to authenticated artist

### GET /api/artist/content/schedule
Lists all scheduled content for the authenticated artist.

**Authentication:** Required (Artist role)

**Query Parameters:**
- `status` (optional): `pending` | `published` | `failed`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

### PUT /api/artist/content/schedule/[id]
Updates scheduled content (reschedule).

**Authentication:** Required (Artist role)

**Request Body:**
```json
{
  "scheduledFor": "2024-12-26T14:00:00Z",
  "timezone": "America/New_York"
}
```

### DELETE /api/artist/content/schedule/[id]
Cancels scheduled content.

**Authentication:** Required (Artist role)

**Query Parameters:**
- `delete` (optional): `true` to delete content entirely, `false` to just unschedule

### GET /api/artist/content/calendar
Returns scheduled content for calendar view.

**Authentication:** Required (Artist role)

**Query Parameters:**
- `month`: Month number (0-11)
- `year`: Year (e.g., 2024)

**Response:**
```json
{
  "success": true,
  "data": {
    "month": 11,
    "year": 2024,
    "contentByDay": {
      "2024-12-25": [
        {
          "id": "content_123",
          "title": "Christmas Special",
          "scheduledFor": "2024-12-25T12:00:00Z",
          "timezone": "UTC",
          ...
        }
      ]
    },
    "totalScheduled": 5
  }
}
```

### GET /api/artist/content/optimal-times
Returns AI-powered suggestions for optimal posting times.

**Authentication:** Required (Artist role)

**Response:**
```json
{
  "success": true,
  "data": {
    "optimalTimes": [
      {
        "day": "Wednesday",
        "dayOfWeek": 3,
        "hour": 20,
        "time": "8:00 PM",
        "engagement": "Very High",
        "score": 45
      },
      ...
    ],
    "analyzed": {
      "contentCount": 25,
      "viewCount": 1250,
      "subscriberCount": 50
    }
  }
}
```

**Algorithm:**
- Analyzes last 90 days of fan engagement
- Groups views by day of week and hour
- Returns top 5 time slots
- Falls back to recommended defaults for new artists

---

## Discovery & Recommendations

### GET /api/discovery/recommended
Returns personalized artist recommendations.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Number of results (default 20)

**Response:**
```json
{
  "success": true,
  "section": "Recommended for You",
  "artists": [
    {
      "id": "artist_123",
      "displayName": "Artist Name",
      "recommendationScore": 0.85,
      "recommendationReason": "You like Electronic music",
      ...
    }
  ],
  "count": 20
}
```

**Scoring Algorithm:**
- Genre match (30% weight)
- Tag overlap (20% weight)
- Popularity (15% weight)
- Activity (10% weight)
- Price match (10% weight)
- Collaborative filtering (15% weight)

### GET /api/discovery/trending
Returns trending artists based on recent growth.

**Authentication:** Optional

**Query Parameters:**
- `limit` (optional): Number of results (default 20)
- `days` (optional): Time window in days (default 7)

**Response:**
```json
{
  "success": true,
  "section": "Trending Now",
  "artists": [
    {
      "id": "artist_123",
      "displayName": "Artist Name",
      "trendingStats": {
        "newSubscribers": 25,
        "totalSubscribers": 100,
        "growthPercent": 33,
        "period": "7 days"
      },
      ...
    }
  ]
}
```

### GET /api/discovery/new
Returns recently joined artists with quality content.

**Authentication:** Optional

**Query Parameters:**
- `limit` (optional): Number of results (default 20)
- `days` (optional): Joined within last N days (default 30)

**Response:**
```json
{
  "success": true,
  "section": "New & Noteworthy",
  "artists": [
    {
      "id": "artist_123",
      "displayName": "Artist Name",
      "newArtistStats": {
        "joinedDaysAgo": 5,
        "contentCount": 3,
        "subscriberCount": 10,
        "isNew": true
      },
      ...
    }
  ]
}
```

**Filters:**
- Must have Stripe onboarding complete
- Must have at least 1 published content
- Must have at least 1 active tier

### GET /api/discovery/similar/[artistId]
Returns artists similar to the given artist.

**Authentication:** Optional

**Path Parameters:**
- `artistId`: The artist to find similar artists for

**Query Parameters:**
- `limit` (optional): Number of results (default 10)

**Response:**
```json
{
  "success": true,
  "artists": [
    {
      "id": "artist_456",
      "displayName": "Similar Artist",
      "similarityScore": 0.75,
      "sharedTags": ["electronic", "chill"],
      "sharedGenre": "Electronic",
      ...
    }
  ],
  "computed": "pre-computed" | "on-the-fly"
}
```

**Similarity Calculation:**
- Genre match (40% weight)
- Tag overlap (30% weight)
- Shared subscribers (30% weight)
- Runs daily via cron job
- Falls back to on-the-fly calculation if not pre-computed

---

## Analytics & Tracking

### POST /api/analytics/track-interaction
Tracks user interactions for ML-based recommendations.

**Authentication:** Required

**Request Body:**
```json
{
  "interactionType": "VIEW" | "LIKE" | "SUBSCRIBE" | "COMMENT" | "SHARE",
  "targetType": "CONTENT" | "ARTIST" | "STREAM",
  "targetId": "target_123",
  "duration": 120,  // optional, in seconds
  "metadata": {}    // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "interaction_123",
    "userId": "user_456",
    "interactionType": "VIEW",
    "targetType": "CONTENT",
    "targetId": "content_789",
    "duration": 120,
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### GET /api/analytics/track-interaction
Gets user's interaction history.

**Authentication:** Required

**Query Parameters:**
- `targetType` (optional): Filter by target type
- `interactionType` (optional): Filter by interaction type
- `limit` (optional): Number of results (default 100)

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 50
}
```

---

## Admin Tools

### POST /api/admin/calculate-similarities
Manually triggers artist similarity calculation.

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Artist similarity calculation started in background"
}
```

**Note:** Calculation runs asynchronously and may take several minutes for large datasets.

---

## Webhooks

### POST /api/webhooks/stripe
Handles Stripe webhook events.

**Authentication:** Stripe signature verification

**Supported Events:**
- `customer.subscription.trial_will_end` - Trial ending in 3 days
- `customer.subscription.updated` - Trial conversion, status changes
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment
- `account.updated` - Artist onboarding completion

**Security:**
- Requires valid Stripe signature
- Validates against `STRIPE_WEBHOOK_SECRET`
- Returns 400 for invalid signatures

**Side Effects:**
- Updates subscription status in database
- Creates notifications for users
- Sends email notifications
- Updates tier subscriber counts
- Updates onboarding progress

---

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (wrong role)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

**Current Limits:**
- General API: 100 requests/minute per user
- Webhook endpoint: No limit (Stripe-verified only)
- Discovery endpoints: 60 requests/minute per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**
- `limit`: Number of items per page (default varies by endpoint)
- `offset`: Number of items to skip (default 0)
- `cursor`: Cursor-based pagination (where supported)

**Response Format:**
```json
{
  "success": true,
  "data": [...],
  "count": 20,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

---

## Webhooks Configuration

To receive webhook events, configure your endpoint in Stripe Dashboard:

**Production Endpoint:** `https://your-domain.com/api/webhooks/stripe`

**Events to Enable:**
1. `customer.subscription.trial_will_end`
2. `customer.subscription.updated`
3. `customer.subscription.deleted`
4. `invoice.payment_succeeded`
5. `invoice.payment_failed`
6. `account.updated`

**Environment Variable:**
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

## Testing

### Test Mode

All Stripe-related endpoints work in test mode. Use Stripe test API keys and test cards.

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 9995`
- Requires authentication: `4000 0025 0000 3155`

### Webhook Testing

Use Stripe CLI to test webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger customer.subscription.trial_will_end
```

---

## Support

For questions or issues with these APIs:
- Check server logs for detailed error information
- Review integration test plan at `TIER1_INTEGRATION_TEST_PLAN.md`
- Contact development team

---

**Last Updated:** 2024-01-24
**API Version:** 1.0
**Documentation Version:** 1.0
