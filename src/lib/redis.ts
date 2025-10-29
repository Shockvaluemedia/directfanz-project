/**
 * Redis client implementation for caching frequently accessed data
 */
import { createClient } from 'redis';
import { logger } from './logger';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

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
};

/**
 * Initialize Redis client
 */
export const getRedisClient = async () => {
  if (!redisClient) {
    try {
      const url = process.env.REDIS_URL;

      if (!url || url.trim() === '') {
        logger.warn('Redis URL not configured, caching disabled');
        return null;
      }

      redisClient = createClient({ 
        url,
        socket: {
          connectTimeout: 5000, // 5 second timeout
          lazyConnect: true
        }
      });

      redisClient.on('error', err => {
        logger.error('Redis client error', {}, err);
        // Don't crash on Redis errors
        redisClient = null;
      });

      // Add connection timeout
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      logger.info('Redis client connected');
    } catch (error) {
      logger.error('Failed to initialize Redis client', {}, error as Error);
      redisClient = null;
    }
  }

  return redisClient;
};

/**
 * Get cached data
 * @param key Cache key
 * @returns Cached data or null if not found
 */
export const getCachedData = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (error) {
    logger.error('Error getting cached data', { key }, error as Error);
    return null;
  }
};

/**
 * Set data in cache
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in seconds
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
    logger.error('Error setting cached data', { key }, error as Error);
  }
};

/**
 * Delete cached data
 * @param key Cache key
 */
export const deleteCachedData = async (key: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.del(key);
  } catch (error) {
    logger.error('Error deleting cached data', { key }, error as Error);
  }
};

/**
 * Delete multiple cached items by pattern
 * @param pattern Key pattern to match
 */
export const deleteCachedPattern = async (pattern: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) return;

    // Use SCAN to find keys matching pattern
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
  } catch (error) {
    logger.error('Error deleting cached pattern', { pattern }, error as Error);
  }
};

/**
 * Cache wrapper for async functions
 * @param key Cache key
 * @param fn Function to execute if cache miss
 * @param ttl Cache TTL in seconds
 * @returns Function result (from cache or execution)
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
 * Gracefully close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
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
};
