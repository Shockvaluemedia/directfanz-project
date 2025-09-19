import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create optimized Prisma client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],

    // Optimize for performance
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Performance monitoring middleware
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;

  // Log slow queries (>1 second in development, >2 seconds in production)
  const threshold = process.env.NODE_ENV === 'development' ? 1000 : 2000;

  if (duration > threshold) {
    logger.warn(`🐌 Slow Query Detected (${duration}ms)`, {
      model: params.model,
      action: params.action,
      duration,
      threshold,
      // Don't log sensitive args in production
      ...(process.env.NODE_ENV === 'development' && { args: params.args }),
    });
  }

  // Track query metrics for monitoring
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 Query: ${params.model}.${params.action} (${duration}ms)`);
  }

  return result;
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});

export default prisma;
