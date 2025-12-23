/**
 * Optimized health check utilities for serverless and ECS environments
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { checkDatabaseConnection } from './prisma';
import { checkPgBouncerHealth, shouldUsePgBouncer } from './pgbouncer-config';
import { logger } from './logger';

// Lightweight Prisma client for health checks only
let healthCheckPrisma: PrismaClient | null = null;

/**
 * Get or create a lightweight Prisma client for health checks
 * Uses minimal configuration to reduce cold start time
 */
export const getHealthCheckPrisma = () => {
  if (!healthCheckPrisma) {
    healthCheckPrisma = new PrismaClient({
      log: ['error'], // Minimal logging
      datasources: {
        db: {
          url: process.env.DATABASE_URL + '?connection_limit=1&pool_timeout=5',
        },
      },
    });
  }
  return healthCheckPrisma;
};

/**
 * Perform a comprehensive database health check for RDS
 * Uses the enhanced database connection from prisma.ts
 */
export const checkDatabaseHealth = async (): Promise<{ 
  status: 'ok' | 'error'; 
  latency: number; 
  message?: string;
  details?: any;
}> => {
  const startTime = Date.now();
  
  try {
    // Use the enhanced database health check
    const healthResult = await checkDatabaseConnection();
    
    return {
      status: healthResult.status === 'healthy' ? 'ok' : 'error',
      latency: healthResult.latency,
      message: healthResult.status === 'healthy' ? undefined : 'Database health check failed',
      details: {
        ...healthResult.details,
        pgbouncer: shouldUsePgBouncer() ? await checkPgBouncerHealth() : { status: 'not_used' },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    logger.error('Database health check failed', { error: message });
    
    return {
      status: 'error',
      latency: Date.now() - startTime,
      message: message.includes('timeout') || message.includes('timed out') 
        ? 'Database connection timeout' 
        : 'Database connection failed',
      details: {
        error: message,
        pgbouncer: shouldUsePgBouncer() ? { status: 'unknown' } : { status: 'not_used' },
      },
    };
  }
};

/**
 * Perform a comprehensive Redis health check for ElastiCache
 * Uses the enhanced ElastiCache client from redis.ts
 */
export const checkRedisHealth = async (): Promise<{ 
  status: 'ok' | 'error'; 
  latency: number; 
  message?: string;
  details?: any;
}> => {
  const startTime = Date.now();
  
  try {
    // Use the enhanced ElastiCache health check
    const { checkElastiCacheHealth } = await import('./redis');
    const healthResult = await checkElastiCacheHealth();
    
    return {
      status: healthResult.status === 'healthy' ? 'ok' : 'error',
      latency: healthResult.latency,
      message: healthResult.status === 'healthy' ? undefined : 'ElastiCache health check failed',
      details: healthResult.details,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Redis error';
    logger.error('Redis health check failed', { error: message });
    
    return {
      status: 'error',
      latency: Date.now() - startTime,
      message: message.includes('timeout') || message.includes('timed out')
        ? 'Redis connection timeout'
        : 'Redis connection failed',
      details: {
        error: message,
        isElastiCache: process.env.REDIS_URL?.includes('cache.amazonaws.com') || false,
      },
    };
  }
};

/**
 * Cleanup health check resources
 */
export const cleanupHealthCheck = async (): Promise<void> => {
  if (healthCheckPrisma) {
    try {
      await healthCheckPrisma.$disconnect();
      healthCheckPrisma = null;
    } catch (error) {
      logger.warn('Failed to cleanup health check Prisma connection', { error });
    }
  }
};

// Register cleanup handlers
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanupHealthCheck);
  process.on('SIGINT', cleanupHealthCheck);
  process.on('SIGTERM', cleanupHealthCheck);
}