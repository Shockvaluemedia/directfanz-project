import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { subscriptionCache } from '@/lib/subscription-cache';
import { performanceMonitor } from '@/lib/performance-monitor';
import { subscriptionPerformanceMonitor } from '@/lib/subscription-performance-monitor';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 3000;

/**
 * The admin monitoring page renders every field of this shape unconditionally
 * (calling .toFixed / .toLocaleString on the numbers), so each source is
 * probed independently with a timeout and falls back to a safe value.
 */

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    (timer as unknown as { unref?: () => void }).unref?.();
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function checkDatabase(): Promise<{ status: string; latency: number }> {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'healthy', latency: Date.now() - start };
}

async function countDatabaseConnections(): Promise<number> {
  // ::int keeps the count out of BigInt territory, which JSON can't serialise.
  const rows = (await prisma.$queryRaw`
    SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()
  `) as Array<{ count: number }>;
  return finite(rows?.[0]?.count);
}

async function checkRedis(): Promise<{ status: string; memoryUsage: string }> {
  const client = getRedisClient();
  if (!client) {
    return { status: 'not_configured', memoryUsage: 'N/A' };
  }
  const start = Date.now();
  await client.ping();
  const latency = Date.now() - start;
  const info = await client.info('memory');
  const memoryUsage = /used_memory_human:(\S+)/.exec(info)?.[1] ?? 'unknown';
  return { status: latency > 500 ? 'degraded' : 'connected', memoryUsage };
}

// GET /api/admin/monitoring - live system metrics for the admin monitoring page
export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => {
    const [db, connections, activeUsers, redis] = await Promise.allSettled([
      withTimeout(checkDatabase(), CHECK_TIMEOUT_MS),
      withTimeout(countDatabaseConnections(), CHECK_TIMEOUT_MS),
      withTimeout(
        prisma.users.count({ where: { updatedAt: { gte: new Date(Date.now() - DAY_MS) } } }),
        CHECK_TIMEOUT_MS
      ),
      withTimeout(checkRedis(), CHECK_TIMEOUT_MS),
    ]);

    const checks = { database: db, connections, activeUsers, redis } as const;
    for (const [name, result] of Object.entries(checks)) {
      if (result.status === 'rejected') {
        logger.warn('Monitoring check failed', {
          check: name,
          error: (result.reason as Error)?.message,
        });
      }
    }

    const database =
      db.status === 'fulfilled'
        ? {
            status: db.value.status,
            latency: finite(db.value.latency),
            connections: connections.status === 'fulfilled' ? connections.value : 0,
          }
        : { status: 'unhealthy', latency: 0, connections: 0 };

    const redisResult =
      redis.status === 'fulfilled' ? redis.value : { status: 'disconnected', memoryUsage: 'N/A' };

    const apiStats = performanceMonitor.getMetricStats('api.response_time');
    const perf = subscriptionPerformanceMonitor.getPerformanceStats(DAY_MS);

    return NextResponse.json({
      status: database.status === 'healthy' ? 'healthy' : 'unhealthy',
      activeUsers: activeUsers.status === 'fulfilled' ? finite(activeUsers.value) : 0,
      apiLatency: finite(apiStats?.avg),
      // The monitor reports a 0-1 fraction; the page shows a percentage.
      errorRate: finite(perf?.errorRate) * 100,
      uptime: formatUptime(process.uptime()),
      database,
      redis: { ...redisResult, hitRate: finite(subscriptionCache.getMetrics()?.hitRate) },
      endpoints: [],
      recentErrors: [],
    });
  });
}
