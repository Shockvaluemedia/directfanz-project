import { NextRequest, NextResponse } from 'next/server';
import { EnvironmentHealthCheck } from '@/lib/parameter-store';
import { checkRedisHealth } from '@/lib/redis-production';
import { checkDatabaseHealth } from '@/lib/database-production';
import { checkServicesHealth } from '@/lib/service-manager-production';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    environment: {
      healthy: boolean;
      errors?: string[];
    };
    database: {
      healthy: boolean;
      latency?: number;
      connectionPool?: any;
      error?: string;
    };
    redis: {
      healthy: boolean;
      latency?: number;
      error?: string;
    };
    services: {
      healthy: boolean;
      services: any;
      summary: {
        total: number;
        healthy: number;
        unhealthy: number;
      };
    };
  };
  summary: {
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    overallHealth: number; // percentage
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [envHealth, dbHealth, redisHealth, servicesHealth] = await Promise.allSettled([
      new EnvironmentHealthCheck().checkHealth(),
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkServicesHealth(),
    ]);

    // Process results
    const environmentCheck = envHealth.status === 'fulfilled' ? envHealth.value : { healthy: false, errors: ['Environment check failed'] };
    const databaseCheck = dbHealth.status === 'fulfilled' ? dbHealth.value : { healthy: false, error: 'Database check failed' };
    const redisCheck = redisHealth.status === 'fulfilled' ? redisHealth.value : { healthy: false, error: 'Redis check failed' };
    const servicesCheck = servicesHealth.status === 'fulfilled' ? servicesHealth.value : { 
      healthy: false, 
      services: {}, 
      summary: { total: 0, healthy: 0, unhealthy: 0 } 
    };

    // Calculate overall health
    const checks = [
      environmentCheck.healthy,
      databaseCheck.healthy,
      redisCheck.healthy,
      servicesCheck.healthy,
    ];

    const healthyCount = checks.filter(Boolean).length;
    const totalChecks = checks.length;
    const overallHealth = (healthyCount / totalChecks) * 100;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (overallHealth === 100) {
      status = 'healthy';
    } else if (overallHealth >= 75) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        environment: environmentCheck,
        database: databaseCheck,
        redis: redisCheck,
        services: servicesCheck,
      },
      summary: {
        totalChecks,
        healthyChecks: healthyCount,
        unhealthyChecks: totalChecks - healthyCount,
        overallHealth: Math.round(overallHealth),
      },
    };

    // Set appropriate HTTP status code
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    // Add performance metrics
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        ...result,
        meta: {
          responseTime: `${responseTime}ms`,
          requestId: crypto.randomUUID(),
        },
      },
      { 
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        environment: { healthy: false, errors: ['Health check system failure'] },
        database: { healthy: false, error: 'Unable to check database' },
        redis: { healthy: false, error: 'Unable to check Redis' },
        services: { 
          healthy: false, 
          services: {}, 
          summary: { total: 0, healthy: 0, unhealthy: 0 } 
        },
      },
      summary: {
        totalChecks: 4,
        healthyChecks: 0,
        unhealthyChecks: 4,
        overallHealth: 0,
      },
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        ...errorResult,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          responseTime: `${responseTime}ms`,
          requestId: crypto.randomUUID(),
        },
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Simple health check for load balancers
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    // Quick database ping
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.healthy) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}