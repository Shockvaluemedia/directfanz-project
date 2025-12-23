import { NextResponse } from 'next/server';
import { checkDatabaseHealth, checkRedisHealth } from '@/lib/health-utils';
import { getContainerHealth, isRunningInECS } from '@/lib/aws-config';
import { logger } from '@/lib/logger';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Timeout configuration based on environment
const FUNCTION_TIMEOUT = isRunningInECS() ? 10000 : 25000; // 10s for ECS, 25s for serverless
const CONNECTION_TIMEOUT = isRunningInECS() ? 3000 : 5000; // 3s for ECS, 5s for serverless

/**
 * Health check endpoint optimized for both serverless and ECS environments
 * This endpoint checks database and Redis connectivity with timeouts
 * Supports ALB health checks when running in ECS
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const isALBHealthCheck = url.searchParams.get('source') === 'alb' || 
                          request.headers.get('user-agent')?.includes('ELB-HealthChecker');

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

  // For ALB health checks, include container health
  if (isALBHealthCheck || isRunningInECS()) {
    try {
      const containerHealth = await withTimeout(getContainerHealth(), CONNECTION_TIMEOUT);
      checks.container = {
        status: containerHealth.status === 'healthy' ? 'ok' : 'error',
        message: containerHealth.status === 'healthy' ? undefined : 'Container health check failed',
        ...containerHealth.checks,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      checks.container = {
        status: 'error',
        message: message.includes('timed out') ? 'Container health check timeout' : 'Container health check failed',
      };
    }
  }

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
  const containerHealthy = !checks.container || checks.container.status === 'ok';
  
  const isHealthy = dbHealthy && redisHealthy && containerHealthy;
  const isDegraded = dbHealthy && !redisHealthy && containerHealthy; // Can still function without Redis
  
  const totalLatency = Date.now() - startTime;

  // Log health check results
  if (isHealthy) {
    logger.info('Health check passed', { latency: totalLatency, isALBHealthCheck });
  } else if (isDegraded) {
    logger.warn('Health check degraded - Redis unavailable', { checks, latency: totalLatency, isALBHealthCheck });
  } else {
    logger.error('Health check failed', { checks, latency: totalLatency, isALBHealthCheck });
  }

  // Return appropriate status
  const status = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy';
  const httpStatus = isHealthy ? 200 : isDegraded ? 200 : 503; // 200 for degraded (still functional)

  // For ALB health checks, return simpler response
  if (isALBHealthCheck) {
    return NextResponse.json(
      {
        status: isHealthy ? 'UP' : 'DOWN',
        timestamp: new Date().toISOString(),
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Health-Check': 'ALB',
        },
      }
    );
  }

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
