import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { subscriptionCache, SubscriptionCacheUtils } from '@/lib/subscription-cache';
import { invalidateAnalyticsCache } from '@/lib/analytics-cached';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

/**
 * Webhook endpoint for subscription changes
 * Automatically invalidates relevant caches when subscriptions are created, updated, or canceled
 */

interface SubscriptionWebhookPayload {
  type:
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.canceled'
    | 'subscription.deleted';
  data: {
    subscriptionId: string;
    fanId: string;
    artistId: string;
    tierId: string;
    status: string;
    amount: number;
    previousStatus?: string;
  };
  timestamp: string;
}

// Webhook signature verification using HMAC-SHA256 with timing-safe comparison
function verifyWebhookSignature(signature: string, payload: string): boolean {
  const secret = process.env.SUBSCRIPTION_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('SUBSCRIPTION_WEBHOOK_SECRET is not configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
  } catch {
    // Lengths differ — signatures don't match
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-webhook-signature');

    if (!signature) {
      logger.warn('Webhook request missing signature');
      return apiError('UNAUTHORIZED', 'Missing webhook signature');
    }

    const body = await request.text();

    // Verify webhook signature
    if (!verifyWebhookSignature(signature, body)) {
      logger.warn('Invalid webhook signature', { signature });
      return apiError('UNAUTHORIZED', 'Invalid webhook signature');
    }

    const payload: SubscriptionWebhookPayload = JSON.parse(body);

    logger.info('Received subscription webhook', {
      type: payload.type,
      subscriptionId: payload.data.subscriptionId,
      artistId: payload.data.artistId,
    });

    const { subscriptionId, fanId, artistId, tierId, status, previousStatus } = payload.data;

    // Invalidate subscription-related caches
    await Promise.all([
      // Invalidate subscription-specific cache
      subscriptionCache.invalidateSubscriptionCache(subscriptionId, fanId, artistId, tierId),

      // Invalidate analytics caches
      invalidateAnalyticsCache(artistId, 'all'),

      // Invalidate fan-specific caches
      SubscriptionCacheUtils.invalidateFanCaches(fanId),
    ]);

    // Handle specific subscription events
    switch (payload.type) {
      case 'subscription.created':
        logger.info('New subscription created', {
          subscriptionId,
          artistId,
          fanId,
          tierId,
          amount: payload.data.amount,
        });

        // Warm up caches for the artist after a new subscription
        await Promise.all([
          subscriptionCache.getArtistSubscriptionMetrics(artistId),
          subscriptionCache.getTierSubscriptionAnalytics(artistId),
        ]);
        break;

      case 'subscription.updated':
        logger.info('Subscription updated', {
          subscriptionId,
          artistId,
          previousStatus,
          newStatus: status,
        });

        // If subscription status changed significantly, do additional cache warming
        if (previousStatus === 'PENDING' && status === 'ACTIVE') {
          await subscriptionCache.getArtistSubscriptionMetrics(artistId);
        }
        break;

      case 'subscription.canceled':
        logger.info('Subscription canceled', {
          subscriptionId,
          artistId,
          fanId,
        });

        // Update trending tiers cache since cancellation affects trends
        await subscriptionCache.getTrendingTiers();
        break;

      case 'subscription.deleted':
        logger.info('Subscription deleted', {
          subscriptionId,
          artistId,
        });

        // Full cache invalidation for deleted subscriptions
        await Promise.all([
          SubscriptionCacheUtils.invalidateArtistCaches(artistId),
          SubscriptionCacheUtils.invalidateFanCaches(fanId),
        ]);
        break;
    }

    // Log cache performance metrics
    const cacheMetrics = subscriptionCache.getMetrics();
    logger.info('Cache metrics after webhook processing', {
      hitRate: cacheMetrics.hitRate,
      totalRequests: cacheMetrics.totalRequests,
      errors: cacheMetrics.errors,
    });

    return apiSuccess({ message: 'Subscription webhook processed successfully',
      cacheInvalidated: true,
      timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Subscription webhook error', {}, error as Error);

    return apiError('INTERNAL_ERROR', 'Failed to process subscription webhook', {
        timestamp: new Date().toISOString() });
  }
}

// Health check endpoint for webhook system
export async function GET() {
  try {
    const health = await subscriptionCache.healthCheck();

    return apiSuccess({
      webhookSystem: 'healthy',
      cacheSystem: health.status,
      cacheMetrics: health.metrics,
      supportedEvents: [
        'subscription.created',
        'subscription.updated',
        'subscription.canceled',
        'subscription.deleted',
      ],
      lastCheck: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Webhook health check failed', {}, error as Error);

    return apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error');
  }
}
