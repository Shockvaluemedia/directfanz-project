import { PrismaClient } from '@prisma/client';

interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
  enableSSL?: boolean;
  enableLogging?: boolean;
}

export class ProductionDatabaseClient {
  private prisma: PrismaClient;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy = true;
  private connectionPool: {
    active: number;
    idle: number;
    total: number;
  } = { active: 0, idle: 0, total: 0 };

  constructor(config: DatabaseConfig) {
    // Configure Prisma with production settings
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.buildConnectionString(config),
        },
      },
      log: config.enableLogging 
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : ['error'],
      errorFormat: 'pretty',
    });

    this.setupEventHandlers();
    this.startHealthCheck();
  }

  private buildConnectionString(config: DatabaseConfig): string {
    const url = new URL(config.url);
    
    // Add SSL configuration for production
    if (config.enableSSL !== false) {
      url.searchParams.set('sslmode', 'require');
      url.searchParams.set('sslcert', '');
      url.searchParams.set('sslkey', '');
      url.searchParams.set('sslrootcert', '');
    }

    // Add connection pool settings
    if (config.maxConnections) {
      url.searchParams.set('connection_limit', config.maxConnections.toString());
    }

    // Add timeout settings
    if (config.connectionTimeout) {
      url.searchParams.set('connect_timeout', Math.floor(config.connectionTimeout / 1000).toString());
    }

    // Add PgBouncer compatibility settings
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('prepared_statements', 'false');

    return url.toString();
  }

  private setupEventHandlers(): void {
    // Log slow queries in production
    this.prisma.$on('query', (e) => {
      if (e.duration > 1000) { // Log queries taking more than 1 second
        console.warn(`Slow query detected: ${e.duration}ms`, {
          query: e.query,
          params: e.params,
          duration: e.duration,
        });
      }
    });

    this.prisma.$on('error', (e) => {
      console.error('Database error:', e);
      this.isHealthy = false;
    });

    this.prisma.$on('info', (e) => {
      console.info('Database info:', e.message);
    });

    this.prisma.$on('warn', (e) => {
      console.warn('Database warning:', e.message);
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Simple health check query
        await this.prisma.$queryRaw`SELECT 1 as health_check`;
        
        // Update connection pool stats
        await this.updateConnectionPoolStats();
        
        if (!this.isHealthy) {
          console.log('Database health check passed - connection restored');
          this.isHealthy = true;
        }
      } catch (error) {
        console.error('Database health check failed:', error);
        this.isHealthy = false;
      }
    }, 30000); // Check every 30 seconds
  }

  private async updateConnectionPoolStats(): Promise<void> {
    try {
      // Query PostgreSQL connection stats
      const stats = await this.prisma.$queryRaw<Array<{
        state: string;
        count: bigint;
      }>>`
        SELECT state, count(*) as count
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
      `;

      this.connectionPool = { active: 0, idle: 0, total: 0 };
      
      for (const stat of stats) {
        const count = Number(stat.count);
        this.connectionPool.total += count;
        
        if (stat.state === 'active') {
          this.connectionPool.active = count;
        } else if (stat.state === 'idle') {
          this.connectionPool.idle = count;
        }
      }
    } catch (error) {
      console.error('Failed to update connection pool stats:', error);
    }
  }

  // Core database operations with error handling
  async findUnique<T>(model: any, args: any): Promise<T | null> {
    try {
      return await model.findUnique(args);
    } catch (error) {
      console.error('Database findUnique error:', error);
      throw error;
    }
  }

  async findMany<T>(model: any, args: any): Promise<T[]> {
    try {
      return await model.findMany(args);
    } catch (error) {
      console.error('Database findMany error:', error);
      throw error;
    }
  }

  async create<T>(model: any, args: any): Promise<T> {
    try {
      return await model.create(args);
    } catch (error) {
      console.error('Database create error:', error);
      throw error;
    }
  }

  async update<T>(model: any, args: any): Promise<T> {
    try {
      return await model.update(args);
    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    }
  }

  async delete<T>(model: any, args: any): Promise<T> {
    try {
      return await model.delete(args);
    } catch (error) {
      console.error('Database delete error:', error);
      throw error;
    }
  }

  // Transaction support with retry logic
  async transaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(fn, {
          timeout: 10000, // 10 second timeout
          isolationLevel: 'ReadCommitted',
        });
      } catch (error) {
        lastError = error as Error;
        console.error(`Transaction attempt ${attempt} failed:`, error);
        
        // Don't retry on certain errors
        if (error instanceof Error && 
            (error.message.includes('Unique constraint') || 
             error.message.includes('Foreign key constraint'))) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  // Raw query execution with timeout
  async queryRaw<T = unknown>(query: string, ...values: any[]): Promise<T> {
    try {
      return await this.prisma.$queryRawUnsafe(query, ...values);
    } catch (error) {
      console.error('Raw query error:', error);
      throw error;
    }
  }

  // Health check methods
  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database ping failed:', error);
      return false;
    }
  }

  getHealthStatus(): {
    healthy: boolean;
    connectionPool: typeof this.connectionPool;
  } {
    return {
      healthy: this.isHealthy,
      connectionPool: { ...this.connectionPool },
    };
  }

  // Performance monitoring
  async getSlowQueries(limit = 10): Promise<any[]> {
    try {
      return await this.prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY mean_time DESC 
        LIMIT ${limit}
      `;
    } catch (error) {
      console.error('Failed to get slow queries:', error);
      return [];
    }
  }

  async getConnectionStats(): Promise<any> {
    try {
      return await this.prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
    } catch (error) {
      console.error('Failed to get connection stats:', error);
      return null;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    try {
      await this.prisma.$disconnect();
      console.log('Database connection closed gracefully');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }

  // Get the underlying Prisma client for direct access
  get client(): PrismaClient {
    return this.prisma;
  }
}

// Singleton instance for production use
let databaseInstance: ProductionDatabaseClient | null = null;

export function getDatabaseClient(): ProductionDatabaseClient {
  if (!databaseInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    databaseInstance = new ProductionDatabaseClient({
      url: databaseUrl,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
      enableSSL: process.env.NODE_ENV === 'production',
      enableLogging: process.env.NODE_ENV !== 'production',
    });
  }

  return databaseInstance;
}

// Health check endpoint helper
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  connectionPool?: any;
  error?: string;
}> {
  try {
    const client = getDatabaseClient();
    const start = Date.now();
    
    const pingResult = await client.ping();
    const latency = Date.now() - start;
    
    const healthStatus = client.getHealthStatus();
    const connectionStats = await client.getConnectionStats();
    
    return {
      healthy: pingResult && healthStatus.healthy,
      latency,
      connectionPool: {
        ...healthStatus.connectionPool,
        stats: connectionStats,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default ProductionDatabaseClient;