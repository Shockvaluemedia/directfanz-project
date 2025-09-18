import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { captureMessage } from '@/lib/sentry';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Cron health check endpoint for scheduled monitoring
 * This endpoint runs deeper health checks and reports metrics
 */
export async function GET() {
  const startTime = Date.now();
  const metrics: Record<string, any> = {};
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; metrics?: any }> = {};

  // Check database connection and get some metrics
  try {
    // Check active users in the last 24 hours (using updatedAt as proxy)
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    // Check active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE
      }
    });
    
    // Check recent content uploads
    const recentContent = await prisma.content.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    metrics.database = {
      activeUsers,
      activeSubscriptions,
      recentContent
    };
    
    checks.database = { 
      status: 'ok',
      metrics: {
        connectionLatency: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Cron health check: Database metrics collection failed', {}, error as Error);
    checks.database = { 
      status: 'error',
      message: 'Could not collect database metrics'
    };
  }

  // Check Redis connection and memory usage
  try {
    const info = await redis.info();
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';
    
    metrics.redis = {
      memoryUsage
    };
    
    checks.redis = { 
      status: 'ok',
      metrics: {
        connectionLatency: Date.now() - startTime
      }
    };
  } catch (error) {
    logger.error('Cron health check: Redis metrics collection failed', {}, error as Error);
    checks.redis = { 
      status: 'error',
      message: 'Could not collect Redis metrics'
    };
  }

  // Overall status
  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  const totalLatency = Date.now() - startTime;

  // Send metrics to monitoring system
  if (process.env.NODE_ENV === 'production') {
    captureMessage('System health metrics', {
      metrics,
      checks,
      latency: totalLatency,
      isHealthy
    });
  }

  // Log health check results
  if (isHealthy) {
    logger.info('Cron health check passed', { latency: totalLatency, metrics });
  } else {
    logger.warn('Cron health check failed', { checks, latency: totalLatency });
  }

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    metrics,
    latency: totalLatency
  }, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}