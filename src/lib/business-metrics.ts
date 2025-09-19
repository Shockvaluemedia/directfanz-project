/**
 * Business Metrics Tracking Library
 *
 * Centralized tracking for business-critical events and KPIs
 * Supports multiple backends: Prometheus, Sentry, Analytics services
 */

import { logger } from './logger';
import { captureMessage, setUser, Sentry } from './sentry';
import client from 'prom-client';

// Types for business events
export interface BusinessEvent {
  event: string;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
  timestamp?: Date;
  value?: number;
  currency?: string;
}

export interface UserEvent extends BusinessEvent {
  userId: string;
  userRole?: 'creator' | 'fan' | 'admin';
  subscriptionTier?: string;
}

export interface PaymentEvent extends BusinessEvent {
  paymentId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  creatorId?: string;
  fanId?: string;
}

export interface ContentEvent extends BusinessEvent {
  contentId: string;
  contentType: 'image' | 'video' | 'audio' | 'text' | 'live_stream' | 'post';
  creatorId: string;
  tierRequired?: string;
}

export interface SubscriptionEvent extends BusinessEvent {
  subscriptionId: string;
  creatorId: string;
  fanId: string;
  tierName: string;
  amount: number;
  currency: string;
  status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
}

// Prometheus metrics
const prometheusMetrics = {
  // User metrics
  userRegistrations: new client.Counter({
    name: 'direct_fan_user_registrations_total',
    help: 'Total number of user registrations',
    labelNames: ['user_type', 'registration_method', 'source'],
  }),

  userLogins: new client.Counter({
    name: 'direct_fan_user_logins_total',
    help: 'Total number of user logins',
    labelNames: ['user_type', 'login_method', 'status'],
  }),

  activeUsers: new client.Gauge({
    name: 'direct_fan_active_users',
    help: 'Number of active users in different time periods',
    labelNames: ['period', 'user_type'],
  }),

  // Payment metrics
  paymentAttempts: new client.Counter({
    name: 'direct_fan_payment_attempts_total',
    help: 'Total number of payment attempts',
    labelNames: ['payment_method', 'currency', 'status'],
  }),

  paymentValues: new client.Histogram({
    name: 'direct_fan_payment_amounts',
    help: 'Distribution of payment amounts',
    labelNames: ['currency', 'payment_type'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  }),

  subscriptionRevenue: new client.Gauge({
    name: 'direct_fan_subscription_revenue',
    help: 'Current monthly recurring revenue from subscriptions',
    labelNames: ['currency', 'tier'],
  }),

  // Subscription metrics
  subscriptionChanges: new client.Counter({
    name: 'direct_fan_subscription_changes_total',
    help: 'Total subscription lifecycle events',
    labelNames: ['action', 'tier', 'reason'],
  }),

  activeSubscriptions: new client.Gauge({
    name: 'direct_fan_active_subscriptions',
    help: 'Number of active subscriptions',
    labelNames: ['tier', 'creator_id'],
  }),

  churnRate: new client.Gauge({
    name: 'direct_fan_churn_rate',
    help: 'Subscription churn rate percentage',
    labelNames: ['period', 'tier'],
  }),

  // Content metrics
  contentUploads: new client.Counter({
    name: 'direct_fan_content_uploads_total',
    help: 'Total content uploads',
    labelNames: ['content_type', 'creator_tier'],
  }),

  contentViews: new client.Counter({
    name: 'direct_fan_content_views_total',
    help: 'Total content views/interactions',
    labelNames: ['content_type', 'viewer_tier', 'creator_tier'],
  }),

  contentEngagement: new client.Histogram({
    name: 'direct_fan_content_engagement_duration_seconds',
    help: 'Time spent engaging with content',
    labelNames: ['content_type'],
    buckets: [1, 5, 15, 30, 60, 180, 300, 600, 1200, 3600],
  }),

  // Business health metrics
  conversionRate: new client.Gauge({
    name: 'direct_fan_conversion_rate',
    help: 'Conversion rate from free users to subscribers',
    labelNames: ['period', 'source'],
  }),

  averageRevenuePerUser: new client.Gauge({
    name: 'direct_fan_arpu',
    help: 'Average Revenue Per User',
    labelNames: ['period', 'user_segment'],
  }),

  customerLifetimeValue: new client.Gauge({
    name: 'direct_fan_customer_ltv',
    help: 'Customer Lifetime Value',
    labelNames: ['acquisition_channel', 'tier'],
  }),
};

class BusinessMetricsTracker {
  private isEnabled: boolean;
  private debug: boolean;

  constructor() {
    this.isEnabled = process.env.ENABLE_BUSINESS_METRICS !== 'false';
    this.debug = process.env.NODE_ENV === 'development';
  }

  /**
   * Track a generic business event
   */
  track(event: BusinessEvent): void {
    if (!this.isEnabled) return;

    try {
      const eventData = {
        ...event,
        timestamp: event.timestamp || new Date(),
      };

      if (this.debug) {
        logger.info('Business event tracked', eventData);
      }

      // Send to Sentry as breadcrumb for context
      if (process.env.NODE_ENV === 'production') {
        Sentry.addBreadcrumb({
          category: 'business',
          message: event.event,
          data: event.properties,
          level: 'info',
        });
      }

      // Log for analytics processing
      logger.info('business_event', eventData);
    } catch (error) {
      logger.error('Failed to track business event', { event: event.event }, error as Error);
    }
  }

  /**
   * Track user registration
   */
  trackUserRegistration(data: {
    userId: string;
    userType: 'creator' | 'fan';
    method: 'email' | 'google' | 'facebook' | 'twitter' | 'apple';
    source?: string;
  }): void {
    prometheusMetrics.userRegistrations.inc({
      user_type: data.userType,
      registration_method: data.method,
      source: data.source || 'direct',
    });

    this.track({
      event: 'user_registered',
      userId: data.userId,
      properties: {
        userType: data.userType,
        method: data.method,
        source: data.source,
      },
    });

    // Set user context in Sentry
    setUser(data.userId);
  }

  /**
   * Track user login
   */
  trackUserLogin(data: {
    userId: string;
    userType: 'creator' | 'fan' | 'admin';
    method: 'email' | 'google' | 'facebook' | 'twitter' | 'apple';
    status: 'success' | 'failed';
    failureReason?: string;
  }): void {
    prometheusMetrics.userLogins.inc({
      user_type: data.userType,
      login_method: data.method,
      status: data.status,
    });

    this.track({
      event: 'user_login',
      userId: data.userId,
      properties: {
        userType: data.userType,
        method: data.method,
        status: data.status,
        failureReason: data.failureReason,
      },
    });

    if (data.status === 'failed') {
      captureMessage(
        'Login failure',
        {
          userId: data.userId,
          reason: data.failureReason,
          method: data.method,
        },
        'warning'
      );
    }
  }

  /**
   * Track payment events
   */
  trackPayment(data: PaymentEvent): void {
    prometheusMetrics.paymentAttempts.inc({
      payment_method: data.paymentMethod,
      currency: data.currency,
      status: data.properties?.status || 'unknown',
    });

    prometheusMetrics.paymentValues.observe(
      {
        currency: data.currency,
        payment_type: data.properties?.paymentType || 'subscription',
      },
      data.amount
    );

    this.track({
      event: 'payment_processed',
      userId: data.fanId || data.userId,
      properties: {
        paymentId: data.paymentId,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        creatorId: data.creatorId,
        subscriptionId: data.subscriptionId,
        status: data.properties?.status,
      },
      value: data.amount,
      currency: data.currency,
    });

    // Alert on payment failures
    if (data.properties?.status === 'failed') {
      captureMessage(
        'Payment failure',
        {
          paymentId: data.paymentId,
          amount: data.amount,
          currency: data.currency,
          creatorId: data.creatorId,
          fanId: data.fanId,
          reason: data.properties?.failureReason,
        },
        'warning'
      );
    }
  }

  /**
   * Track subscription events
   */
  trackSubscription(data: SubscriptionEvent): void {
    const action = data.properties?.action || 'unknown';

    prometheusMetrics.subscriptionChanges.inc({
      action,
      tier: data.tierName,
      reason: data.properties?.reason || 'user_action',
    });

    // Update active subscription count
    if (action === 'created' || action === 'activated') {
      prometheusMetrics.activeSubscriptions.inc({
        tier: data.tierName,
        creator_id: data.creatorId,
      });
    } else if (action === 'cancelled' || action === 'expired') {
      prometheusMetrics.activeSubscriptions.dec({
        tier: data.tierName,
        creator_id: data.creatorId,
      });
    }

    this.track({
      event: 'subscription_changed',
      userId: data.fanId,
      properties: {
        subscriptionId: data.subscriptionId,
        creatorId: data.creatorId,
        tierName: data.tierName,
        action,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        reason: data.properties?.reason,
      },
      value: data.amount,
      currency: data.currency,
    });

    // Alert on subscription cancellations
    if (action === 'cancelled') {
      captureMessage(
        'Subscription cancelled',
        {
          subscriptionId: data.subscriptionId,
          creatorId: data.creatorId,
          fanId: data.fanId,
          tierName: data.tierName,
          reason: data.properties?.reason,
        },
        'info'
      );
    }
  }

  /**
   * Track content interactions
   */
  trackContent(data: ContentEvent): void {
    const action = data.properties?.action || 'view';

    if (action === 'upload') {
      prometheusMetrics.contentUploads.inc({
        content_type: data.contentType,
        creator_tier: data.properties?.creatorTier || 'unknown',
      });
    } else if (action === 'view' || action === 'interact') {
      prometheusMetrics.contentViews.inc({
        content_type: data.contentType,
        viewer_tier: data.properties?.viewerTier || 'free',
        creator_tier: data.properties?.creatorTier || 'unknown',
      });

      // Track engagement duration if provided
      if (data.properties?.duration) {
        prometheusMetrics.contentEngagement.observe(
          { content_type: data.contentType },
          data.properties.duration
        );
      }
    }

    this.track({
      event: 'content_interaction',
      userId: data.userId,
      properties: {
        contentId: data.contentId,
        contentType: data.contentType,
        creatorId: data.creatorId,
        action,
        tierRequired: data.tierRequired,
        duration: data.properties?.duration,
        viewerTier: data.properties?.viewerTier,
      },
    });
  }

  /**
   * Update active user counts
   */
  updateActiveUsers(
    period: '1h' | '24h' | '7d' | '30d',
    userType: 'creator' | 'fan' | 'total',
    count: number
  ): void {
    prometheusMetrics.activeUsers.set({ period, user_type: userType }, count);
  }

  /**
   * Update conversion rates
   */
  updateConversionRate(period: '24h' | '7d' | '30d', source: string, rate: number): void {
    prometheusMetrics.conversionRate.set({ period, source }, rate);
  }

  /**
   * Update ARPU (Average Revenue Per User)
   */
  updateARPU(period: '30d' | '90d' | '365d', segment: string, arpu: number): void {
    prometheusMetrics.averageRevenuePerUser.set({ period, user_segment: segment }, arpu);
  }

  /**
   * Update Customer Lifetime Value
   */
  updateCustomerLTV(channel: string, tier: string, ltv: number): void {
    prometheusMetrics.customerLifetimeValue.set({ acquisition_channel: channel, tier }, ltv);
  }

  /**
   * Get current metrics registry for Prometheus
   */
  getMetricsRegistry(): client.Registry {
    return client.register;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    client.register.resetMetrics();
  }
}

// Export singleton instance
export const businessMetrics = new BusinessMetricsTracker();
