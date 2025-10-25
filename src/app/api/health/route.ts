import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Health check endpoint for monitoring system status
 * This endpoint checks database and Redis connectivity
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }> = {
    api: { status: 'ok' },
  };

  // Check database connection
  try {
    const dbStartTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'ok',
      latency: Date.now() - dbStartTime,
    };
  } catch (error) {
    logger.error('Health check: Database connection failed', {}, error as Error);
    checks.database = {
      status: 'error',
      message: 'Could not connect to database',
    };
  }

  // Check Redis connection
  try {
    const redisStartTime = Date.now();
    await redis.ping();
    checks.redis = {
      status: 'ok',
      latency: Date.now() - redisStartTime,
    };
  } catch (error) {
    logger.error('Health check: Redis connection failed', {}, error as Error);
    checks.redis = {
      status: 'error',
      message: 'Could not connect to Redis',
    };
  }

  // Check Tier 1 Features
  try {
    // Check onboarding_progress table
    await prisma.onboarding_progress.findFirst();

    // Check scheduled_publish table
    const pendingPublishes = await prisma.scheduled_publish.count({
      where: {
        published: false,
        scheduledFor: { lte: new Date() },
      },
    });

    // Check failed publishes
    const failedPublishes = await prisma.scheduled_publish.count({
      where: {
        failedAt: { not: null },
        published: false,
      },
    });

    checks.tier1Features = {
      status: failedPublishes > 20 ? 'error' : 'ok',
      message: failedPublishes > 20 ? `${failedPublishes} failed publishes` : undefined,
    };
  } catch (error) {
    logger.error('Health check: Tier 1 features check failed', {}, error as Error);
    checks.tier1Features = {
      status: 'error',
      message: 'Tier 1 features check failed',
    };
  }

  // Overall status
  const isHealthy = Object.values(checks).every(check => check.status === 'ok');
  const totalLatency = Date.now() - startTime;

  // Log health check results
  if (isHealthy) {
    logger.info('Health check passed', { latency: totalLatency });
  } else {
    logger.warn('Health check failed', { checks, latency: totalLatency });
  }

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      latency: totalLatency,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
