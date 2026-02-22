import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Synchronous Prisma client creation for Next.js compatibility
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // During build time, DATABASE_URL may not be available.
    // Return a client that will fail at query time, not at import time.
    return new PrismaClient();
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: { url: databaseUrl },
    },
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Connection management
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

const connectToDB = async (): Promise<void> => {
  if (isConnected) return;

  while (connectionAttempts < MAX_CONNECTION_ATTEMPTS && !isConnected) {
    try {
      connectionAttempts++;
      await prisma.$connect();
      isConnected = true;
      connectionAttempts = 0; // Reset on success

      console.log(`Database connected successfully (attempt ${connectionAttempts})`);

      // Test connection with a simple query
      await prisma.$executeRaw`SELECT 1`;
      console.log('Database connection verified');

    } catch (error) {
      console.error(`Database connection attempt ${connectionAttempts} failed:`, error);
      isConnected = false;

      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        throw new Error(`Failed to connect to database after ${MAX_CONNECTION_ATTEMPTS} attempts: ${error}`);
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts - 1), 10000);
      console.log(`Retrying database connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Enable connection reuse in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown with connection draining
const cleanup = async (): Promise<void> => {
  if (isConnected) {
    try {
      console.log('Draining database connections...');

      const drainTimeout = setTimeout(() => {
        console.warn('Database connection drain timeout, forcing disconnect');
      }, 10000);

      await prisma.$disconnect();
      clearTimeout(drainTimeout);

      isConnected = false;
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Error during database disconnect:', error);
    }
  }
};

// Register cleanup handlers
process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Export connection helper
export const ensureConnection = async (): Promise<void> => {
  if (!isConnected) {
    await connectToDB();
  }
};

// Export connection status
export const getConnectionStatus = (): {
  isConnected: boolean;
  attempts: number;
} => ({
  isConnected,
  attempts: connectionAttempts,
});

// Health check helper
export const checkDatabaseConnection = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  details: any;
}> => {
  const startTime = Date.now();

  try {
    // Test basic connectivity
    await prisma.$executeRaw`SELECT 1 as health_check`;

    // Test transaction capability
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 as transaction_test`;
    });

    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency,
      details: {
        isConnected,
        connectionAttempts,
        poolInfo: 'Connection pooling active',
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      status: 'unhealthy',
      latency,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        isConnected,
        connectionAttempts,
      },
    };
  }
};
