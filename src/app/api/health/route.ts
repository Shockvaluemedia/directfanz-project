import { NextResponse } from 'next/server';
import { checkDatabaseHealth, checkRedisHealth } from '@/lib/health-utils';
import { logger } from '@/lib/logger';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Serverless function timeout (25 seconds for Vercel)
const FUNCTION_TIMEOUT = 25000;
const CONNECTION_TIMEOUT = 5000; // 5 seconds max per connection check

/**
 * Health check endpoint optimized for serverless environment
 * This endpoint checks database and Redis connectivity with timeouts
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latency?: number }> = {
    api: { status: 'ok' },
  };

  // Helper function to run checks with timeout
  const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  };

  // Run database and Redis checks in parallel with timeout
  const [databaseResult, redisResult] = await Promise.allSettled([
    withTimeout(checkDatabaseHealth(), CONNECTION_TIMEOUT),
    withTimeout(checkRedisHealth(), CONNECTION_TIMEOUT),
  ]);

  // Process database check result
  if (databaseResult.status === 'fulfilled') {
    checks.database = databaseResult.value;
  } else {
    const error = databaseResult.reason;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check: Database check failed', { error: message });
    checks.database = {
      status: 'error',
      latency: 0,
      message: message.includes('timed out') ? 'Database connection timeout' : 'Database health check failed',
    };
  }

  // Process Redis check result
  if (redisResult.status === 'fulfilled') {
    checks.redis = redisResult.value;
  } else {
    const error = redisResult.reason;
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check: Redis check failed', { error: message });
    checks.redis = {
      status: 'error',
      latency: 0,
      message: message.includes('timed out') ? 'Redis connection timeout' : 'Redis health check failed',
    };
  }

  // Overall status - consider degraded if Redis fails but DB is ok
  const dbHealthy = checks.database.status === 'ok';
  const redisHealthy = checks.redis.status === 'ok';
  const isHealthy = dbHealthy && redisHealthy;
  const isDegraded = dbHealthy && !redisHealthy; // Can still function without Redis
  
  const totalLatency = Date.now() - startTime;

  // Log health check results
  if (isHealthy) {
    logger.info('Health check passed', { latency: totalLatency });
  } else if (isDegraded) {
    logger.warn('Health check degraded - Redis unavailable', { checks, latency: totalLatency });
  } else {
    logger.error('Health check failed', { checks, latency: totalLatency });
  }

  // Return appropriate status
  const status = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy';
  const httpStatus = isHealthy ? 200 : isDegraded ? 200 : 503; // 200 for degraded (still functional)

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks,
      latency: totalLatency,
      environment: process.env.NODE_ENV || 'unknown',
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Health-Check': 'true',
      },
    }
  );
}
