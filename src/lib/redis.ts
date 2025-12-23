/**
 * Redis client implementation optimized for AWS ElastiCache
 * Supports cluster mode, authentication, and failover
 */
import { createClient, createCluster } from 'redis';
import { getParameter, isRunningInECS } from './aws-config';
import { logger } from './logger';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | ReturnType<typeof createCluster> | null = null;
let isClusterMode = false;

// Cache TTL defaults (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};

// Cache key prefixes
export const CACHE_KEYS = {
  USER: 'user:',
  ARTIST: 'artist:',
  ARTISTS_LIST: 'artists:list:',
  TIER: 'tier:',
  TIERS_BY_ARTIST: 'tiers:artist:',
  CONTENT: 'content:',
  CONTENT_BY_ARTIST: 'content:artist:',
  SUBSCRIPTION: 'subscription:',
  SUBSCRIPTIONS_BY_FAN: 'subscriptions:fan:',
  SUBSCRIPTIONS_BY_ARTIST: 'subscriptions:artist:',
  ANALYTICS: 'analytics:artist:',
  COMMENTS: 'comments:content:',
  SESSION: 'session:',
  STREAM: 'stream:',
  CHAT: 'chat:',
};

/**
 * Get Redis configuration from Parameter Store or environment
 */
const getRedisConfig = async () => {
  const redisUrl = await getParameter('/directfanz/redis/url', 'REDIS_URL');
  const authToken = await getParameter('/directfanz/redis/auth-token', 'REDIS_AUTH_TOKEN');
  const clusterMode = process.env.REDIS_CLUSTER_MODE === 'true';
  
  return {
    url: redisUrl,
    authToken,
    clusterMode,
    isElastiCache: isRunningInECS() && redisUrl?.includes('cache.amazonaws.com'),
  };
};

/**
 * Create ElastiCache cluster client
 */
const createElastiCacheCluster = async (config: any) => {
  const url = new URL(config.url);
  const nodes = [
    {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
    },
  ];

  // Add additional cluster nodes if specified
  const additionalNodes = process.env.REDIS_CLUSTER_NODES?.split(',') || [];
  for (const nodeUrl of additionalNodes) {
    const nodeUrlParsed = new URL(nodeUrl);
    nodes.push({
      host: nodeUrlParsed.hostname,
      port: parseInt(nodeUrlParsed.port) || 6379,
    });
  }

  const clusterClient = createCluster({
    rootNodes: nodes,
    defaults: {
      socket: {
        connectTimeout: 5000,
        commandTimeout: 3000,
        lazyConnect: true,
        tls: config.isElastiCache, // Enable TLS for ElastiCache
      },
      ...(config.authToken && { password: config.authToken }),
    },
    useReplicas: true, // Use read replicas for read operations
    enableAutoPipelining: true, // Optimize performance
  });

  return clusterClient;
};

/**
 * Create single Redis client
 */
const createSingleRedisClient = async (config: any) => {
  const client = createClient({
    url: config.url,
    socket: {
      connectTimeout: 5000,
      commandTimeout: 3000,
      lazyConnect: true,
      tls: config.isElastiCache, // Enable TLS for ElastiCache
    },
    ...(config.authToken && { password: config.authToken }),
  });

  return client;
};

/**
 * Initialize Redis client with ElastiCache support
 */
export const getRedisClient = async () => {
  if (!redisClient) {
    try {
      const config = await getRedisConfig();

      if (!config.url || config.url.trim() === '') {
        logger.warn('Redis URL not configured, caching disabled');
        return null;
      }

      logger.info('Initializing Redis client', {
        isElastiCache: config.isElastiCache,
        clusterMode: config.clusterMode,
        hasAuth: !!config.authToken,
      });

      // Create appropriate client based on configuration
      if (config.clusterMode) {
        redisClient = await createElastiCacheCluster(config);
        isClusterMode = true;
        logger.info('Created ElastiCache cluster client');
      } else {
        redisClient = await createSingleRedisClient(config);
        isClusterMode = false;
        logger.info('Created single Redis client');
      }

      // Set up error handling
      redisClient.on('error', err => {
        logger.error('Redis client error', { error: err.message });
        // Don't crash on Redis errors, just disable caching
        redisClient = null;
      });

      redisClient.on('connect', () => {
        logger.info('Redis client connected');
      });

      redisClient.on('ready', () => {
        logger.info('Redis client ready');
      });

      redisClient.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      redisClient.on('end', () => {
        logger.info('Redis client connection ended');
      });

      // Connect with timeout
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      logger.info('Redis client connected successfully');

    } catch (error) {
      logger.error('Failed to initialize Redis client', { error: error instanceof Error ? error.message : 'Unknown error' });
      redisClient = null;
    }
  }

  return redisClient;
};

/**
 * Get cached data with cluster support
 */
export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (error) {
    logger.error('Error getting cached data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};

/**
 * Set data in cache with cluster support
 */
export const setCachedData = async <T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.set(key, JSON.stringify(data), { EX: ttl });
  } catch (error) {
    logger.error('Error setting cached data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete cached data with cluster support
 */
export const deleteCachedData = async (key: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.del(key);
  } catch (error) {
    logger.error('Error deleting cached data', { key, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Delete multiple cached items by pattern with cluster support
 */
export const deleteCachedPattern = async (pattern: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) return;

    if (isClusterMode) {
      // For cluster mode, we need to scan all nodes
      const clusterClient = client as ReturnType<typeof createCluster>;
      const masters = clusterClient.getMasters();
      
      for (const master of masters) {
        let cursor = 0;
        do {
          const { cursor: nextCursor, keys } = await master.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          cursor = nextCursor;
          
          if (keys.length > 0) {
            await clusterClient.del(keys);
          }
        } while (cursor !== 0);
      }
    } else {
      // Single node mode
      let cursor = 0;
      do {
        const { cursor: nextCursor, keys } = await client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = nextCursor;
        
        if (keys.length > 0) {
          await client.del(keys);
        }
      } while (cursor !== 0);
    }
  } catch (error) {
    logger.error('Error deleting cached pattern', { pattern, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Cache wrapper for async functions with cluster support
 */
export const withCache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<T> => {
  // Try to get from cache first
  const cachedData = await getCachedData<T>(key);

  if (cachedData !== null) {
    return cachedData;
  }

  // Cache miss, execute function
  const result = await fn();

  // Cache the result
  await setCachedData(key, result, ttl);

  return result;
};

/**
 * Session management for ElastiCache
 */
export const setSession = async (sessionId: string, sessionData: any, ttl: number = 3600): Promise<void> => {
  await setCachedData(`${CACHE_KEYS.SESSION}${sessionId}`, sessionData, ttl);
};

export const getSession = async <T>(sessionId: string): Promise<T | null> => {
  return await getCachedData<T>(`${CACHE_KEYS.SESSION}${sessionId}`);
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await deleteCachedData(`${CACHE_KEYS.SESSION}${sessionId}`);
};

/**
 * Stream data management for real-time features
 */
export const setStreamData = async (streamId: string, streamData: any, ttl: number = 7200): Promise<void> => {
  await setCachedData(`${CACHE_KEYS.STREAM}${streamId}`, streamData, ttl);
};

export const getStreamData = async <T>(streamId: string): Promise<T | null> => {
  return await getCachedData<T>(`${CACHE_KEYS.STREAM}${streamId}`);
};

export const deleteStreamData = async (streamId: string): Promise<void> => {
  await deleteCachedData(`${CACHE_KEYS.STREAM}${streamId}`);
};

/**
 * Chat message caching for streams
 */
export const setChatMessages = async (streamId: string, messages: any[], ttl: number = 3600): Promise<void> => {
  await setCachedData(`${CACHE_KEYS.CHAT}${streamId}`, messages, ttl);
};

export const getChatMessages = async (streamId: string): Promise<any[] | null> => {
  return await getCachedData<any[]>(`${CACHE_KEYS.CHAT}${streamId}`);
};

/**
 * Health check for ElastiCache
 */
export const checkElastiCacheHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  details: any;
}> => {
  const startTime = Date.now();
  
  try {
    const client = await getRedisClient();
    if (!client) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        details: { error: 'Redis client not available' },
      };
    }

    // Test basic operations
    const testKey = 'health_check_test';
    const testValue = { timestamp: Date.now(), test: true };
    
    await client.set(testKey, JSON.stringify(testValue), { EX: 10 });
    const retrieved = await client.get(testKey);
    await client.del(testKey);
    
    const parsedValue = JSON.parse(retrieved || '{}');
    const isValid = parsedValue.test === true;
    
    return {
      status: isValid ? 'healthy' : 'unhealthy',
      latency: Date.now() - startTime,
      details: {
        clusterMode: isClusterMode,
        testPassed: isValid,
        isElastiCache: (await getRedisConfig()).isElastiCache,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        clusterMode: isClusterMode,
      },
    };
  }
};

/**
 * Gracefully close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
};

/**
 * Export redis client for backwards compatibility
 */
export const redis = {
  ping: async () => {
    const client = await getRedisClient();
    return client ? await client.ping() : 'PONG';
  },
  get: async (key: string) => {
    const client = await getRedisClient();
    return client ? await client.get(key) : null;
  },
  set: async (key: string, value: string, options?: any) => {
    const client = await getRedisClient();
    return client ? await client.set(key, value, options) : null;
  },
  del: async (key: string) => {
    const client = await getRedisClient();
    return client ? await client.del(key) : 0;
  },
  info: async () => {
    const client = await getRedisClient();
    return client ? await client.info() : 'redis_unavailable';
  },
  exists: async (key: string) => {
    const client = await getRedisClient();
    return client ? await client.exists(key) : 0;
  },
  expire: async (key: string, seconds: number) => {
    const client = await getRedisClient();
    return client ? await client.expire(key, seconds) : false;
  },
  ttl: async (key: string) => {
    const client = await getRedisClient();
    return client ? await client.ttl(key) : -1;
  },
};
