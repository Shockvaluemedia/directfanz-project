import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced database URL with connection pooling parameters
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Add connection pooling parameters to prevent prepared statement conflicts
  const url = new URL(baseUrl);
  url.searchParams.set('pool_timeout', '20');
  url.searchParams.set('connection_limit', '5');
  
  return url.toString();
};

// Create Prisma client with optimized settings and error handling
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  // Prevent connection timeout issues
  transactionOptions: {
    timeout: 10000, // 10 seconds
  },
});

// Enhanced connection management
let isConnected = false;

const connectToDB = async () => {
  if (isConnected) return;
  
  try {
    await prisma.$connect();
    isConnected = true;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    isConnected = false;
    throw error;
  }
};

// Optimize connection pooling for production
if (process.env.NODE_ENV === 'production') {
  connectToDB().catch((error) => {
    console.error('Production database connection failed:', error);
  });
}

// Enable connection reuse in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Enhanced graceful shutdown
const cleanup = async () => {
  if (isConnected) {
    try {
      await prisma.$disconnect();
      isConnected = false;
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Error during database disconnect:', error);
    }
  }
};

process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Export connection helper
export const ensureConnection = async () => {
  if (!isConnected) {
    await connectToDB();
  }
};
