# Business Monitoring Implementation Guide

This guide shows how to implement comprehensive business monitoring for your Direct-to-Fan Platform using the new business metrics tracking system.

## Overview

The business monitoring system provides:

1. **Business Metrics Tracking** - Key business events and KPIs
2. **Payment Flow Monitoring** - Comprehensive Stripe integration tracking
3. **User Engagement Tracking** - User behavior and content interaction analytics
4. **Enhanced Sentry Integration** - Business context for error debugging
5. **Prometheus Metrics** - Time-series metrics for Grafana dashboards
6. **Admin Dashboard APIs** - Business intelligence endpoints

## Quick Start

### 1. Install Dependencies

```bash
npm install prom-client
```

### 2. Environment Variables

Add these to your `.env.production`:

```env
# Business Metrics Configuration
ENABLE_BUSINESS_METRICS=true
ENABLE_USER_TRACKING=true
ANONYMIZE_USER_DATA=true
USER_TRACKING_SALT=your-secure-salt-for-hashing

# Metrics API Authentication (optional)
METRICS_AUTH_TOKEN=your-secure-metrics-token

# Enhanced Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

### 3. Basic Implementation

#### Track User Registration

```typescript
import { userEngagementTracker } from '@/lib/user-engagement-tracking';

// In your registration handler
async function handleUserRegistration(userData: any) {
  try {
    // Your registration logic...
    const user = await createUser(userData);
    
    // Track the registration
    userEngagementTracker.trackUserRegistration({
      userId: user.id,
      email: user.email,
      userType: user.role, // 'creator' or 'fan'
      registrationMethod: 'email', // or 'google', 'facebook', etc.
      source: 'landing_page',
      marketingChannel: 'organic_search',
      hasCompletedProfile: false,
    }, {
      source: 'web',
      platform: 'desktop',
      referrer: request.headers.referer,
      userAgent: request.headers['user-agent'],
    });
    
  } catch (error) {
    // Error will automatically include business context in Sentry
    throw error;
  }
}
```

#### Track Payment Events

```typescript
import { paymentMonitor } from '@/lib/payment-monitoring';

// In your Stripe webhook handler
async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      paymentMonitor.trackPaymentSuccess(paymentIntent, {
        userId: paymentIntent.metadata.fan_id,
        creatorId: paymentIntent.metadata.creator_id,
        source: 'web',
      });
      break;
      
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      
      paymentMonitor.trackPaymentFailure(failedPayment, {
        userId: failedPayment.metadata.fan_id,
        creatorId: failedPayment.metadata.creator_id,
        source: 'web',
      });
      break;
      
    case 'customer.subscription.created':
      const subscription = event.data.object as Stripe.Subscription;
      
      paymentMonitor.trackSubscriptionCreated(subscription, {
        userId: subscription.metadata.fan_id,
        creatorId: subscription.metadata.creator_id,
        subscriptionTier: subscription.metadata.tier_name,
        source: 'web',
      });
      break;
  }
}
```

#### Track Content Interactions

```typescript
import { userEngagementTracker } from '@/lib/user-engagement-tracking';

// In your content viewing handler
async function trackContentView(contentId: string, viewerId: string, duration: number) {
  const content = await getContent(contentId);
  
  userEngagementTracker.trackContentInteraction({
    contentId,
    contentType: content.type,
    creatorId: content.creatorId,
    viewerId,
    action: 'view',
    duration,
    isSubscribed: await isUserSubscribed(viewerId, content.creatorId),
    tierRequired: content.tierRequired,
  }, {
    source: 'web',
    platform: detectPlatform(request.headers['user-agent']),
  });
}

// Track content uploads
async function trackContentUpload(creatorId: string, contentData: any) {
  userEngagementTracker.trackCreatorActivity({
    creatorId,
    action: 'content_upload',
    contentType: contentData.type,
    metadata: {
      contentId: contentData.id,
      fileSize: contentData.size,
      duration: contentData.duration,
      creatorTier: await getCreatorTier(creatorId),
    },
  }, {
    source: 'web',
    platform: 'desktop',
  });
}
```

#### Enhanced Error Tracking

```typescript
import { captureError } from '@/lib/sentry';

// In your error handlers
async function handlePaymentError(error: Error, context: any) {
  captureError(error, {
    // User context
    userId: context.userId,
    userType: context.userType,
    subscriptionTier: context.subscriptionTier,
    
    // Payment context
    paymentId: context.paymentId,
    amount: context.amount,
    currency: context.currency,
    paymentMethod: context.paymentMethod,
    stripeCustomerId: context.stripeCustomerId,
    
    // Business context
    businessEvent: 'payment_processing',
    funnel: 'subscription_signup',
    component: 'payment_handler',
    feature: 'stripe_integration',
    
    // Technical context
    source: 'api',
    platform: 'web',
    apiVersion: 'v1',
  }, 'error');
}
```

## API Endpoints

### Business Metrics Dashboard

```typescript
// GET /api/admin/metrics?range=30d
const response = await fetch('/api/admin/metrics?range=30d', {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
  },
});

const metrics = await response.json();
console.log('Total Users:', metrics.summary.totalUsers);
console.log('MRR:', metrics.summary.monthlyRecurringRevenue);
console.log('Conversion Rate:', metrics.summary.conversionRate);
```

### Prometheus Metrics

```typescript
// GET /api/metrics?format=prometheus
// This endpoint is automatically scraped by Prometheus
// Access at: http://your-domain.com/api/metrics?format=prometheus

// For authenticated access:
const response = await fetch('/api/metrics', {
  headers: {
    'Authorization': `Bearer ${process.env.METRICS_AUTH_TOKEN}`,
  },
});
```

## Grafana Dashboard Configuration

### 1. Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'direct-fan-platform'
    static_configs:
      - targets: ['your-app.com:443']
    scheme: https
    metrics_path: '/api/metrics'
    bearer_token: 'your-metrics-auth-token'
    scrape_interval: 30s
    scrape_timeout: 10s
```

### 2. Key Metrics to Monitor

#### Business KPIs
```promql
# Active Users (last 24 hours)
direct_fan_active_users{period="24h",user_type="total"}

# Monthly Recurring Revenue
direct_fan_subscription_revenue{currency="USD"}

# Conversion Rate
direct_fan_conversion_rate{period="30d"}

# User Registrations (rate)
rate(direct_fan_user_registrations_total[1h])
```

#### Payment Metrics
```promql
# Payment Success Rate
rate(direct_fan_payment_attempts_total{status="succeeded"}[5m]) / 
rate(direct_fan_payment_attempts_total[5m]) * 100

# Average Payment Amount
histogram_quantile(0.5, rate(direct_fan_payment_amounts_bucket[5m]))

# Subscription Churn Rate
direct_fan_churn_rate{period="30d"}
```

#### Content Engagement
```promql
# Content Upload Rate
rate(direct_fan_content_uploads_total[1h])

# Content View Rate
rate(direct_fan_content_views_total[1h])

# Average Engagement Duration
histogram_quantile(0.95, rate(direct_fan_content_engagement_duration_seconds_bucket[5m]))
```

### 3. Sample Grafana Queries

#### Revenue Dashboard
```promql
# Total Revenue (last 30 days)
increase(direct_fan_payment_amounts_sum{currency="USD"}[30d])

# Revenue Growth Rate
(increase(direct_fan_payment_amounts_sum[7d]) / increase(direct_fan_payment_amounts_sum[14d] offset 7d) - 1) * 100

# Average Revenue Per User
direct_fan_arpu{period="30d",user_segment="all_users"}
```

#### User Growth Dashboard
```promql
# Daily Active Users
direct_fan_active_users{period="24h",user_type="total"}

# New User Registration Rate
rate(direct_fan_user_registrations_total[1h]) * 3600

# User Retention Rate
# (This would require custom retention metrics based on your user activity tracking)
```

## Advanced Usage

### Custom Business Events

```typescript
import { businessMetrics } from '@/lib/business-metrics';

// Track custom business events
businessMetrics.track({
  event: 'feature_usage',
  userId: 'user-123',
  properties: {
    feature: 'live_streaming',
    duration: 3600, // 1 hour stream
    viewers: 150,
    tips_received: 25.50,
    currency: 'USD',
  },
});

// Track funnel events
businessMetrics.track({
  event: 'funnel_step',
  userId: 'user-123',
  properties: {
    funnel: 'creator_onboarding',
    step: 'profile_setup',
    step_number: 3,
    completed: true,
    time_spent: 120, // 2 minutes
  },
});
```

### A/B Testing Integration

```typescript
// Track experiment participation
businessMetrics.track({
  event: 'experiment_exposure',
  userId: 'user-123',
  properties: {
    experiment: 'new_subscription_flow',
    variant: 'control',
    feature: 'subscription_signup',
  },
});

// Track conversion within experiment
businessMetrics.track({
  event: 'experiment_conversion',
  userId: 'user-123',
  properties: {
    experiment: 'new_subscription_flow',
    variant: 'control',
    converted: true,
    conversion_value: 29.99,
  },
});
```

### Real-time Alerts

#### Sentry Alerts
Configure alerts in Sentry for:
- Payment failure rate > 5%
- Subscription cancellation spike
- High error rates in specific business flows

#### Grafana Alerts
```yaml
# Alert when conversion rate drops below 2%
- alert: LowConversionRate
  expr: direct_fan_conversion_rate{period="24h"} < 2
  for: 5m
  labels:
    severity: warning
    team: growth
  annotations:
    summary: "Conversion rate has dropped below 2%"
    description: "Current conversion rate: {{ $value }}%"

# Alert when payment failure rate is high
- alert: HighPaymentFailureRate
  expr: |
    (
      rate(direct_fan_payment_attempts_total{status="failed"}[5m]) /
      rate(direct_fan_payment_attempts_total[5m])
    ) > 0.1
  for: 2m
  labels:
    severity: critical
    team: payments
  annotations:
    summary: "High payment failure rate detected"
    description: "Payment failure rate: {{ $value | humanizePercentage }}"
```

## Privacy and Compliance

### Data Anonymization
The system supports automatic PII anonymization:

```env
# Enable data anonymization
ANONYMIZE_USER_DATA=true
USER_TRACKING_SALT=your-secure-salt

# User IDs are hashed before being sent to monitoring systems
# IP addresses are truncated to preserve geography while removing PII
# Email addresses are never logged in metrics
```

### GDPR Compliance
- User IDs are hashed when `ANONYMIZE_USER_DATA=true`
- IP addresses are anonymized to /24 subnets
- Sensitive data is filtered from error reports
- Users can opt out via the `ENABLE_USER_TRACKING` setting

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**
   - Check `/api/metrics` endpoint accessibility
   - Verify authentication token if configured
   - Check Prometheus scrape configuration

2. **Business events not tracking**
   - Verify `ENABLE_BUSINESS_METRICS=true`
   - Check application logs for tracking errors
   - Ensure proper imports of tracking libraries

3. **Sentry context not appearing**
   - Verify Sentry DSN configuration
   - Check that context is passed to capture functions
   - Ensure production environment for Sentry reporting

### Monitoring the Monitoring

Track the health of your monitoring system:

```promql
# Metrics collection success rate
rate(direct_fan_platform_metrics_collection_duration_ms[5m])

# Sentry error reporting rate
rate(sentry_errors_total[5m])

# Business event tracking rate
rate(business_events_total[5m])
```

## Next Steps

1. **Set up Grafana Dashboards** - Create comprehensive business intelligence dashboards
2. **Configure Alerts** - Set up proactive monitoring for critical business metrics
3. **Implement Cohort Analysis** - Track user retention and lifetime value over time
4. **A/B Testing** - Use the event tracking system for feature experiments
5. **Real-time Analytics** - Consider adding real-time dashboards for live business metrics

This monitoring system provides a solid foundation for understanding your business performance, user behavior, and technical health. The data collected will help you make data-driven decisions to grow your Direct-to-Fan Platform.