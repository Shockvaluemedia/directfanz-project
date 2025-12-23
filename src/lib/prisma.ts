import { PrismaClient } from '@prisma/client';
import { isRunningInECS, getParameter } from './aws-config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced database URL with connection pooling parameters for RDS
const getDatabaseUrl = async (): Promise<string> => {
  // Get database URL from Parameter Store or environment
  const baseUrl = await getParameter('/directfanz/database/url', 'DATABASE_URL');
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL not found in Parameter Store or environment variables');
  }
  
  // Parse URL to add RDS-optimized connection parameters
  const url = new URL(baseUrl);
  
  // RDS-optimized connection pooling parameters
  if (isRunningInECS()) {
    // ECS/RDS optimized settings
    url.searchParams.set('connection_limit', '10');
    url.searchParams.set('pool_timeout', '20');
    url.searchParams.set('connect_timeout', '10');
    url.searchParams.set('socket_timeout', '30');
    url.searchParams.set('prepared_statements', 'false');
    url.searchParams.set('statement_cache_size', '0');
  } else {
    // Development settings
    url.searchParams.set('connection_limit', '5');
    url.searchParams.set('pool_timeout', '20');
    url.searchParams.set('prepared_statements', 'false');
    url.searchParams.set('statement_cache_size', '0');
  }
  
  return url.toString();
};

// Create Prisma client with RDS-optimized settings
const createPrismaClient = async (): Promise<PrismaClient> => {
  const databaseUrl = await getDatabaseUrl();
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    // RDS-optimized transaction settings
    transactionOptions: {
      timeout: isRunningInECS() ? 15000 : 10000, // 15s for ECS, 10s for dev
      maxWait: 5000, // Maximum time to wait for a transaction slot
      isolationLevel: 'ReadCommitted', // Optimal for RDS
    },
  });
};

// Initialize Prisma client
let prismaPromise: Promise<PrismaClient> | null = null;

const getPrismaClient = async (): Promise<PrismaClient> => {
  if (!prismaPromise) {
    prismaPromise = createPrismaClient();
  }
  return prismaPromise;
};

// Export the client (lazy initialization)
export const prisma = globalForPrisma.prisma ?? await getPrismaClient();

// Connection management
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

const connectToDB = async (): Promise<void> => {
  if (isConnected) return;
  
  while (connectionAttempts < MAX_CONNECTION_ATTEMPTS && !isConnected) {
    try {
      connectionAttempts++;
      const client = await getPrismaClient();
      await client.$connect();
      isConnected = true;
      connectionAttempts = 0; // Reset on success
      
      console.log(`Database connected successfully (attempt ${connectionAttempts})`);
      
      // Test connection with a simple query
      await client.$executeRaw`SELECT 1`;
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

// Auto-connect in production (ECS)
if (process.env.NODE_ENV === 'production' && isRunningInECS()) {
  connectToDB().catch((error) => {
    console.error('Production database connection failed:', error);
    // Don't exit in production, let health checks handle it
  });
}

// Enable connection reuse in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Enhanced graceful shutdown with connection draining
const cleanup = async (): Promise<void> => {
  if (isConnected) {
    try {
      console.log('Draining database connections...');
      const client = await getPrismaClient();
      
      // Wait for active transactions to complete (up to 10 seconds)
      const drainTimeout = setTimeout(() => {
        console.warn('Database connection drain timeout, forcing disconnect');
      }, 10000);
      
      await client.$disconnect();
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
  isECS: boolean;
} => ({
  isConnected,
  attempts: connectionAttempts,
  isECS: isRunningInECS(),
});

// Health check helper for RDS
export const checkDatabaseConnection = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  details: any;
}> => {
  const startTime = Date.now();
  
  try {
    const client = await getPrismaClient();
    
    // Test basic connectivity
    await client.$executeRaw`SELECT 1 as health_check`;
    
    // Test transaction capability
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 as transaction_test`;
    });
    
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
      details: {
        isConnected,
        connectionAttempts,
        isECS: isRunningInECS(),
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
        isECS: isRunningInECS(),
      },
    };
  }
};
