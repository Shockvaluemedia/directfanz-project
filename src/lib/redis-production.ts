import Redis from 'ioredis';

interface RedisConfig {
  url: string;
  retryDelayOnFailover?: number;
  retryDelayOnClusterDown?: number;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  lazyConnect?: boolean;
}

export class ProductionRedisClient {
  private client: Redis;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy = true;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;

  constructor(config: RedisConfig) {
    const redisOptions: Redis.RedisOptions = {
      // Connection settings
      connectTimeout: config.connectTimeout || 10000, // 10 seconds
      commandTimeout: config.commandTimeout || 5000,  // 5 seconds
      lazyConnect: config.lazyConnect || true,
      
      // Retry settings
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      retryDelayOnClusterDown: config.retryDelayOnClusterDown || 300,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      
      // Connection pool settings
      keepAlive: 30000,
      family: 4, // IPv4
      
      // Retry strategy
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      
      // Reconnect on error
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    };

    // Parse Upstash Redis URL or use direct connection
    if (config.url.startsWith('redis://') || config.url.startsWith('rediss://')) {
      this.client = new Redis(config.url, redisOptions);
    } else {
      // For Upstash format: redis://username:password@host:port
      this.client = new Redis(config.url, redisOptions);
    }

    this.setupEventHandlers();
    this.startHealthCheck();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isHealthy = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      console.log('Redis ready for commands');
      this.isHealthy = true;
    });

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
      this.isHealthy = false;
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error('Max Redis connection attempts reached');
      }
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
      this.isHealthy = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis reconnecting...');
      this.isHealthy = false;
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.ping();
        if (!this.isHealthy) {
          console.log('Redis health check passed - connection restored');
          this.isHealthy = true;
        }
      } catch (error) {
        console.error('Redis health check failed:', error);
        this.isHealthy = false;
      }
    }, 30000); // Check every 30 seconds
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      console.error(`Redis HGET error for key ${key}, field ${field}:`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      console.error(`Redis HSET error for key ${key}, field ${field}:`, error);
      return false;
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      console.error(`Redis SADD error for key ${key}:`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      console.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  async zadd(key: string, score: number, member: string): Promise<boolean> {
    try {
      await this.client.zadd(key, score, member);
      return true;
    } catch (error) {
      console.error(`Redis ZADD error for key ${key}:`, error);
      return false;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      console.error(`Redis ZRANGE error for key ${key}:`, error);
      return [];
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  async flushdb(): Promise<boolean> {
    try {
      await this.client.flushdb();
      return true;
    } catch (error) {
      console.error('Redis FLUSHDB error:', error);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis PING error:', error);
      return false;
    }
  }

  getHealthStatus(): { healthy: boolean; connectionAttempts: number } {
    return {
      healthy: this.isHealthy,
      connectionAttempts: this.connectionAttempts,
    };
  }

  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    try {
      await this.client.quit();
      console.log('Redis connection closed gracefully');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

// Singleton instance for production use
let redisInstance: ProductionRedisClient | null = null;

export function getRedisClient(): ProductionRedisClient {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    redisInstance = new ProductionRedisClient({
      url: redisUrl,
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      lazyConnect: true,
    });
  }

  return redisInstance;
}

// Health check endpoint helper
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const client = getRedisClient();
    const start = Date.now();
    
    const pingResult = await client.ping();
    const latency = Date.now() - start;
    
    const healthStatus = client.getHealthStatus();
    
    return {
      healthy: pingResult && healthStatus.healthy,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default ProductionRedisClient;