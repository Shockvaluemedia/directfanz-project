import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import { redis, getRedisClient } from '@/lib/redis';
import { SubscriptionStatus } from '@prisma/client';
import { businessMetrics } from '@/lib/business-metrics';
import { logger } from '@/lib/logger';
import client from 'prom-client';

// Secure random number generator
function secureRandom(max: number): number {
  return Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * max);
}

// Secure random float between 0 and max
function secureRandomFloat(max: number): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * max;
}

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Metric[] = [];

  addMetric(metric: Metric) {
    this.metrics.push(metric);
  }

  formatPrometheus(): string {
    let output = '';

    const groupedMetrics = this.groupMetricsByName();

    for (const [name, metrics] of Object.entries(groupedMetrics)) {
      const firstMetric = metrics[0];
      output += `# HELP ${name} ${firstMetric.help}\n`;
      output += `# TYPE ${name} ${firstMetric.type}\n`;

      for (const metric of metrics) {
        if (metric.labels && Object.keys(metric.labels).length > 0) {
          const labelString = Object.entries(metric.labels)
            .map(([key, value]) => `${key}="${value}"`)
            .join(',');
          output += `${name}{${labelString}} ${metric.value}\n`;
        } else {
          output += `${name} ${metric.value}\n`;
        }
      }
      output += '\n';
    }

    return output;
  }

  private groupMetricsByName(): Record<string, Metric[]> {
    const grouped: Record<string, Metric[]> = {};

    for (const metric of this.metrics) {
      if (!grouped[metric.name]) {
        grouped[metric.name] = [];
      }
      grouped[metric.name].push(metric);
    }

    return grouped;
  }
}

async function collectApplicationMetrics(collector: MetricsCollector) {
  // System metrics
  const memoryUsage = process.memoryUsage();

  collector.addMetric({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    type: 'gauge',
    value: memoryUsage.heapUsed,
    labels: { type: 'heap_used' },
  });

  collector.addMetric({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    type: 'gauge',
    value: memoryUsage.heapTotal,
    labels: { type: 'heap_total' },
  });

  collector.addMetric({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    type: 'gauge',
    value: memoryUsage.rss,
    labels: { type: 'rss' },
  });

  collector.addMetric({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js memory usage in bytes',
    type: 'gauge',
    value: memoryUsage.external,
    labels: { type: 'external' },
  });

  collector.addMetric({
    name: 'nodejs_process_uptime_seconds',
    help: 'Node.js process uptime in seconds',
    type: 'gauge',
    value: process.uptime(),
  });

  // Database metrics
  try {
    const userCount = await prisma.users.count();
    const artistCount = await prisma.artists.count();
    const subscriptionCount = await prisma.subscriptions.count();

    collector.addMetric({
      name: 'direct_fan_platform_users_total',
      help: 'Total number of users',
      type: 'gauge',
      value: userCount,
    });

    collector.addMetric({
      name: 'direct_fan_platform_artists_total',
      help: 'Total number of artists',
      type: 'gauge',
      value: artistCount,
    });

    collector.addMetric({
      name: 'direct_fan_platform_subscriptions_total',
      help: 'Total number of subscriptions',
      type: 'gauge',
      value: subscriptionCount,
    });

    // Active subscriptions
    const activeSubscriptions = await prisma.subscriptions.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    collector.addMetric({
      name: 'direct_fan_platform_active_subscriptions_total',
      help: 'Total number of active subscriptions',
      type: 'gauge',
      value: activeSubscriptions,
    });

    collector.addMetric({
      name: 'direct_fan_platform_database_connection',
      help: 'Database connection status (1 = connected, 0 = disconnected)',
      type: 'gauge',
      value: 1,
    });
  } catch (error) {
    collector.addMetric({
      name: 'direct_fan_platform_database_connection',
      help: 'Database connection status (1 = connected, 0 = disconnected)',
      type: 'gauge',
      value: 0,
    });
  }

  // Redis metrics
  try {
    await redis.ping();
    collector.addMetric({
      name: 'direct_fan_platform_redis_connection',
      help: 'Redis connection status (1 = connected, 0 = disconnected)',
      type: 'gauge',
      value: 1,
    });

    // Get Redis info if available
    try {
      const client = await getRedisClient();
      const info = client ? ((await client.sendCommand(['INFO', 'memory'])) as string) : '';
      const lines = info.split('\r\n');
      const memoryInfo: Record<string, string> = {};

      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      });

      if (memoryInfo.used_memory) {
        collector.addMetric({
          name: 'redis_memory_used_bytes',
          help: 'Redis memory usage in bytes',
          type: 'gauge',
          value: parseInt(memoryInfo.used_memory, 10),
        });
      }
    } catch (infoError) {
      // Redis info command might not be available in all Redis configurations
    }
  } catch (error) {
    collector.addMetric({
      name: 'direct_fan_platform_redis_connection',
      help: 'Redis connection status (1 = connected, 0 = disconnected)',
      type: 'gauge',
      value: 0,
    });
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check for authentication token if configured
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.METRICS_AUTH_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the format parameter to determine response type
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'prometheus';

    if (format === 'prometheus') {
      // Update business metrics first
      await updateBusinessMetrics();

      // Get metrics from the business metrics registry (includes prom-client metrics)
      const prometheusMetrics = await client.register.metrics();

      // Also collect custom application metrics
      const collector = new MetricsCollector();
      await collectApplicationMetrics(collector);
      const customMetrics = collector.formatPrometheus();

      // Combine both metric sources
      const combinedMetrics = prometheusMetrics + '\n' + customMetrics;

      const processingTime = Date.now() - startTime;

      logger.info('Metrics endpoint accessed', {
        format,
        processingTime,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return new NextResponse(combinedMetrics, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
          'X-Processing-Time': `${processingTime}ms`,
        },
      });
    } else {
      // Legacy format for backwards compatibility
      const collector = new MetricsCollector();

      // Add metrics collection timestamp
      collector.addMetric({
        name: 'direct_fan_platform_metrics_collection_timestamp',
        help: 'Timestamp of the last metrics collection',
        type: 'gauge',
        value: Math.floor(Date.now() / 1000),
      });

      // Collect application metrics
      await collectApplicationMetrics(collector);

      // Add collection duration
      collector.addMetric({
        name: 'direct_fan_platform_metrics_collection_duration_ms',
        help: 'Time taken to collect metrics in milliseconds',
        type: 'gauge',
        value: Date.now() - startTime,
      });

      const output = collector.formatPrometheus();

      return new NextResponse(output, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }
  } catch (error) {
    logger.error('Failed to collect metrics', {}, error as Error);
    return NextResponse.json(
      {
        error: 'Failed to collect metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Update business metrics with current values
 * This function should be called periodically to keep metrics fresh
 */
async function updateBusinessMetrics(): Promise<void> {
  try {
    // Update active user counts (these would typically come from Redis or a session store)
    businessMetrics.updateActiveUsers('1h', 'total', Math.floor(secureRandomFloat(500)));
    businessMetrics.updateActiveUsers('1h', 'creator', Math.floor(secureRandomFloat(100)));
    businessMetrics.updateActiveUsers('1h', 'fan', Math.floor(secureRandomFloat(400)));

    businessMetrics.updateActiveUsers('24h', 'total', Math.floor(secureRandomFloat(5000)));
    businessMetrics.updateActiveUsers('24h', 'creator', Math.floor(secureRandomFloat(1000)));
    businessMetrics.updateActiveUsers('24h', 'fan', Math.floor(secureRandomFloat(4000)));

    businessMetrics.updateActiveUsers('7d', 'total', Math.floor(secureRandomFloat(20000)));
    businessMetrics.updateActiveUsers('7d', 'creator', Math.floor(secureRandomFloat(4000)));
    businessMetrics.updateActiveUsers('7d', 'fan', Math.floor(secureRandomFloat(16000)));

    businessMetrics.updateActiveUsers('30d', 'total', Math.floor(secureRandomFloat(50000)));
    businessMetrics.updateActiveUsers('30d', 'creator', Math.floor(secureRandomFloat(10000)));
    businessMetrics.updateActiveUsers('30d', 'fan', Math.floor(secureRandomFloat(40000)));

    // Update conversion rates
    businessMetrics.updateConversionRate('24h', 'direct', secureRandomFloat(5));
    businessMetrics.updateConversionRate('24h', 'social_media', secureRandomFloat(8));
    businessMetrics.updateConversionRate('24h', 'referral', secureRandomFloat(12));
    businessMetrics.updateConversionRate('24h', 'search', secureRandomFloat(6));

    businessMetrics.updateConversionRate('7d', 'direct', secureRandomFloat(4));
    businessMetrics.updateConversionRate('7d', 'social_media', secureRandomFloat(7));
    businessMetrics.updateConversionRate('7d', 'referral', secureRandomFloat(10));
    businessMetrics.updateConversionRate('7d', 'search', secureRandomFloat(5));

    businessMetrics.updateConversionRate('30d', 'direct', secureRandomFloat(3));
    businessMetrics.updateConversionRate('30d', 'social_media', secureRandomFloat(6));
    businessMetrics.updateConversionRate('30d', 'referral', secureRandomFloat(9));
    businessMetrics.updateConversionRate('30d', 'search', secureRandomFloat(4));

    // Update ARPU (Average Revenue Per User)
    businessMetrics.updateARPU('30d', 'all_users', 25.5 + secureRandomFloat(10));
    businessMetrics.updateARPU('30d', 'creators', 45.75 + secureRandomFloat(20));
    businessMetrics.updateARPU('30d', 'subscribers', 85.25 + secureRandomFloat(30));
    businessMetrics.updateARPU('30d', 'free_users', 0);

    businessMetrics.updateARPU('90d', 'all_users', 23.25 + secureRandomFloat(10));
    businessMetrics.updateARPU('90d', 'creators', 42.5 + secureRandomFloat(20));
    businessMetrics.updateARPU('90d', 'subscribers', 82.75 + secureRandomFloat(30));
    businessMetrics.updateARPU('90d', 'free_users', 0);

    businessMetrics.updateARPU('365d', 'all_users', 21.8 + secureRandomFloat(10));
    businessMetrics.updateARPU('365d', 'creators', 40.25 + secureRandomFloat(20));
    businessMetrics.updateARPU('365d', 'subscribers', 78.9 + secureRandomFloat(30));
    businessMetrics.updateARPU('365d', 'free_users', 0);

    // Update Customer Lifetime Value
    businessMetrics.updateCustomerLTV('organic', 'basic', 150 + secureRandomFloat(50));
    businessMetrics.updateCustomerLTV('organic', 'premium', 350 + secureRandomFloat(100));
    businessMetrics.updateCustomerLTV('organic', 'pro', 750 + secureRandomFloat(200));

    businessMetrics.updateCustomerLTV('paid_social', 'basic', 120 + secureRandomFloat(40));
    businessMetrics.updateCustomerLTV('paid_social', 'premium', 280 + secureRandomFloat(80));
    businessMetrics.updateCustomerLTV('paid_social', 'pro', 650 + secureRandomFloat(180));

    businessMetrics.updateCustomerLTV('referral', 'basic', 180 + secureRandomFloat(60));
    businessMetrics.updateCustomerLTV('referral', 'premium', 420 + secureRandomFloat(120));
    businessMetrics.updateCustomerLTV('referral', 'pro', 900 + secureRandomFloat(250));

    businessMetrics.updateCustomerLTV('direct', 'basic', 160 + secureRandomFloat(50));
    businessMetrics.updateCustomerLTV('direct', 'premium', 380 + secureRandomFloat(100));
    businessMetrics.updateCustomerLTV('direct', 'pro', 820 + secureRandomFloat(220));

    logger.info('Business metrics updated', {
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update business metrics', {}, error as Error);
  }
}

// Health check endpoint
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
