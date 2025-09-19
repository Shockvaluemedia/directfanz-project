/**
 * Enhanced Prisma Client with Performance Monitoring
 *
 * This file initializes Prisma with performance monitoring middleware
 * and integrates with the alerting system.
 */

import { PrismaClient } from '@prisma/client';
import { dbMonitor } from './database-monitoring.js';
import { performanceAlerts } from './performance-alerts.js';

// Create Prisma instance with enhanced configuration
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Add database monitoring middleware
prisma.$use(dbMonitor.createMonitoringMiddleware());

// Enhanced middleware to integrate with alerting system
prisma.$use(async (params, next) => {
  const start = performance.now();

  try {
    const result = await next(params);
    const duration = performance.now() - start;

    // Check for slow queries and alert if necessary
    if (duration > performanceAlerts.options.slowQueryThreshold) {
      await performanceAlerts.alertSlowQuery(
        `${params.model}.${params.action}`,
        duration,
        performanceAlerts.options.slowQueryThreshold,
        {
          model: params.model,
          action: params.action,
          args: params.args,
        }
      );
    }

    return result;
  } catch (error) {
    // Alert on database errors
    await performanceAlerts.sendAlert(
      'database_error',
      'warning',
      {
        error: error.message,
        query: `${params.model}.${params.action}`,
        model: params.model,
        action: params.action,
      },
      {
        args: params.args,
        stack: error.stack,
      }
    );

    throw error;
  }
});

// Event listeners for Prisma logs
prisma.$on('query', e => {
  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_QUERIES === 'true') {
    console.log('🔍 Query:', e.query);
    console.log('📊 Duration:', e.duration + 'ms');
  }
});

prisma.$on('error', e => {
  console.error('💥 Prisma Error:', e);
});

prisma.$on('warn', e => {
  console.warn('⚠️ Prisma Warning:', e);
});

prisma.$on('info', e => {
  if (process.env.NODE_ENV === 'development') {
    console.info('ℹ️ Prisma Info:', e);
  }
});

// Health check function
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Database connection check failed:', error);

    // Alert on connection issues
    await performanceAlerts.sendAlert('database_connection_failed', 'critical', {
      error: error.message,
      connection_check: 'failed',
    });

    return {
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected gracefully');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
}

// Initialize monitoring on startup
async function initializeMonitoring() {
  try {
    // Test database connection
    const connectionStatus = await checkDatabaseConnection();

    if (connectionStatus.status === 'connected') {
      console.log('✅ Database connection established');
      console.log('📊 Performance monitoring initialized');

      // Test alert system
      if (process.env.NODE_ENV === 'development') {
        // Uncomment to test alerts on startup
        // await performanceAlerts.testAlerts();
      }
    } else {
      console.error('❌ Database connection failed');
    }
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
  }
}

// Initialize on module load
initializeMonitoring();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

export default prisma;
export { prisma, dbMonitor, performanceAlerts };
