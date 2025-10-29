/**
 * Optimized health check utilities for serverless environment
 */
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
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
 * Perform a fast database health check
 * Uses a simple query with minimal overhead
 */
export const checkDatabaseHealth = async (): Promise<{ status: 'ok' | 'error'; latency: number; message?: string }> => {
  const startTime = Date.now();
  
  try {
    const prisma = getHealthCheckPrisma();
    // Use the simplest possible query
    await prisma.$executeRaw`SELECT 1`;
    
    return {
      status: 'ok',
      latency: Date.now() - startTime,
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
    };
  }
};

/**
 * Perform a fast Redis health check
 * Creates a new connection with minimal configuration
 */
export const checkRedisHealth = async (): Promise<{ status: 'ok' | 'error'; latency: number; message?: string }> => {
  const startTime = Date.now();
  let client: ReturnType<typeof createClient> | null = null;
  
  try {
    if (!process.env.REDIS_URL || process.env.REDIS_URL.trim() === '') {
      return {
        status: 'ok', // Changed to 'ok' since Redis is intentionally disabled
        latency: Date.now() - startTime,
        message: 'Redis disabled (caching unavailable)',
      };
    }

    // Create a minimal Redis client for health check
    client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 3000, // 3 second timeout
        commandTimeout: 2000, // 2 second command timeout
      },
    });

    await client.connect();
    await client.ping();
    
    return {
      status: 'ok',
      latency: Date.now() - startTime,
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
    };
  } finally {
    // Always cleanup the connection
    if (client) {
      try {
        await client.quit();
      } catch (error) {
        // Ignore cleanup errors
        logger.warn('Failed to cleanup Redis health check connection', { error });
      }
    }
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