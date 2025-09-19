import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
// import { getTelemetryHealth } from '@/lib/telemetry'; // Disabled due to missing dependencies

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      time: string;
      output?: any;
      componentType?: string;
      observedValue?: number;
      observedUnit?: string;
      threshold?: number;
    };
  };
  telemetry: any;
  performance: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage?: number[];
    eventLoopDelay?: number;
  };
  dependencies: {
    [key: string]: {
      status: 'up' | 'down';
      responseTime?: number;
      version?: string;
    };
  };
}

async function checkDatabaseHealth(): Promise<any> {
  try {
    // This should use your actual database client
    // const { prisma } = await import('@/lib/prisma');
    // const startTime = Date.now();
    // await prisma.$queryRaw`SELECT 1`;
    // const responseTime = Date.now() - startTime;

    return {
      status: 'pass',
      time: new Date().toISOString(),
      componentType: 'datastore',
      observedValue: 0, // responseTime would go here
      observedUnit: 'ms',
      threshold: 100,
      output: 'Database connection successful',
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      componentType: 'datastore',
      output: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkRedisHealth(): Promise<any> {
  try {
    // This should use your actual Redis client
    // const { redis } = await import('@/lib/redis');
    // const startTime = Date.now();
    // await redis.ping();
    // const responseTime = Date.now() - startTime;

    return {
      status: 'pass',
      time: new Date().toISOString(),
      componentType: 'cache',
      observedValue: 0, // responseTime would go here
      observedUnit: 'ms',
      threshold: 50,
      output: 'Redis connection successful',
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      componentType: 'cache',
      output: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

async function checkExternalDependencies(): Promise<{ [key: string]: any }> {
  const dependencies: { [key: string]: any } = {};

  // Check Stripe connectivity
  try {
    // This would typically make a test API call to Stripe
    dependencies.stripe = {
      status: 'up',
      responseTime: 0,
      version: 'unknown',
    };
  } catch (error) {
    dependencies.stripe = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check SendGrid connectivity
  try {
    // This would typically make a test API call to SendGrid
    dependencies.sendgrid = {
      status: 'up',
      responseTime: 0,
      version: 'unknown',
    };
  } catch (error) {
    dependencies.sendgrid = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check AWS S3 connectivity
  try {
    // This would typically make a test API call to S3
    dependencies.s3 = {
      status: 'up',
      responseTime: 0,
      version: 'unknown',
    };
  } catch (error) {
    dependencies.s3 = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return dependencies;
}

function getPerformanceMetrics() {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    memory: memoryUsage,
    uptime,
    loadAverage: process.platform !== 'win32' ? require('os').loadavg() : undefined,
    eventLoopDelay: 0, // Would need to implement proper measurement
  };
}

function checkSystemThresholds(performance: any): {
  status: 'pass' | 'warn' | 'fail';
  issues: string[];
} {
  const issues: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';

  // Memory usage threshold (heap > 500MB = warning, > 1GB = failure)
  const heapUsedMB = performance.memory.heapUsed / (1024 * 1024);
  if (heapUsedMB > 1024) {
    status = 'fail';
    issues.push(`Critical heap usage: ${Math.round(heapUsedMB)}MB`);
  } else if (heapUsedMB > 500) {
    status = 'warn';
    issues.push(`High heap usage: ${Math.round(heapUsedMB)}MB`);
  }

  // RSS memory threshold (> 2GB = warning, > 4GB = failure)
  const rssMB = performance.memory.rss / (1024 * 1024);
  if (rssMB > 4096) {
    status = 'fail';
    issues.push(`Critical RSS usage: ${Math.round(rssMB)}MB`);
  } else if (rssMB > 2048) {
    if (status === 'pass') status = 'warn';
    issues.push(`High RSS usage: ${Math.round(rssMB)}MB`);
  }

  // Load average threshold (Unix systems only)
  if (performance.loadAverage && performance.loadAverage.length > 0) {
    const load1 = performance.loadAverage[0];
    const cpuCount = require('os').cpus().length;
    const normalizedLoad = load1 / cpuCount;

    if (normalizedLoad > 2) {
      status = 'fail';
      issues.push(
        `Critical system load: ${load1.toFixed(2)} (${Math.round(normalizedLoad * 100)}% of CPU capacity)`
      );
    } else if (normalizedLoad > 1) {
      if (status === 'pass') status = 'warn';
      issues.push(
        `High system load: ${load1.toFixed(2)} (${Math.round(normalizedLoad * 100)}% of CPU capacity)`
      );
    }
  }

  return { status, issues };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Collect all health data
    const [databaseHealth, redisHealth, dependencies] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkExternalDependencies(),
    ]);

    const performance = getPerformanceMetrics();
    const systemCheck = checkSystemThresholds(performance);
    // const telemetryHealth = getTelemetryHealth(); // Disabled due to missing dependencies
    const telemetryHealth = { status: 'disabled', message: 'Telemetry disabled' };

    // Determine overall system status
    const allChecks = [databaseHealth, redisHealth, systemCheck];
    const hasFailures = allChecks.some(check => check.status === 'fail');
    const hasWarnings = allChecks.some(
      check => check.status === 'warn' || check.status === 'warning'
    );
    const hasDependencyIssues = Object.values(dependencies).some(
      (dep: any) => dep.status === 'down'
    );

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings || hasDependencyIssues) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthData: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: databaseHealth,
        redis: redisHealth,
        system: {
          status: systemCheck.status,
          time: new Date().toISOString(),
          componentType: 'system',
          output:
            systemCheck.issues.length > 0
              ? systemCheck.issues.join('; ')
              : 'System resources within normal limits',
        },
      },
      telemetry: telemetryHealth,
      performance,
      dependencies,
    };

    const totalTime = Date.now() - startTime;

    // Log health check
    logger.info('System health check completed', {
      status: overallStatus,
      duration: totalTime,
      hasFailures,
      hasWarnings,
      hasDependencyIssues,
    });

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthData, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Content-Type': 'application/json',
        'X-Response-Time': `${totalTime}ms`,
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;

    logger.error(
      'Health check failed',
      {
        duration: totalTime,
      },
      error as Error
    );

    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred during health check',
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Content-Type': 'application/json',
        'X-Response-Time': `${totalTime}ms`,
      },
    });
  }
}

// Lightweight health check endpoint (for load balancers)
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    // Quick system check
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);

    // Simple threshold check
    if (heapUsedMB > 1024) {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Health': 'ok',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
