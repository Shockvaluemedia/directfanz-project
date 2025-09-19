/**
 * Performance monitoring and testing utilities
 */
import { logger } from './logger';
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

// Performance metric types
export type PerformanceMetric = {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
};

// In-memory store for performance metrics
const performanceMetrics: PerformanceMetric[] = [];

/**
 * Measures the execution time of a function
 * @param name Name of the operation being measured
 * @param fn Function to measure
 * @param metadata Additional context about the operation
 * @returns Result of the function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    // Record the metric
    const metric: PerformanceMetric = {
      name,
      startTime,
      duration,
      metadata,
    };

    performanceMetrics.push(metric);

    // Log slow operations (over 500ms)
    if (duration > 500) {
      logger.warn(`Slow operation detected: ${name}`, {
        duration,
        ...metadata,
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    // Log failed operations
    logger.error(
      `Operation failed: ${name}`,
      {
        duration,
        ...metadata,
      },
      error as Error
    );

    throw error;
  }
}

/**
 * Measures the execution time of a synchronous function
 * @param name Name of the operation being measured
 * @param fn Function to measure
 * @param metadata Additional context about the operation
 * @returns Result of the function
 */
export function measurePerformanceSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const startTime = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - startTime;

    // Record the metric
    const metric: PerformanceMetric = {
      name,
      startTime,
      duration,
      metadata,
    };

    performanceMetrics.push(metric);

    // Log slow operations (over 100ms for sync operations)
    if (duration > 100) {
      logger.warn(`Slow synchronous operation detected: ${name}`, {
        duration,
        ...metadata,
      });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    // Log failed operations
    logger.error(
      `Synchronous operation failed: ${name}`,
      {
        duration,
        ...metadata,
      },
      error as Error
    );

    throw error;
  }
}

/**
 * Get recent performance metrics
 * @param limit Maximum number of metrics to return
 * @returns Array of performance metrics
 */
export function getRecentMetrics(limit = 100): PerformanceMetric[] {
  return performanceMetrics.slice(-limit);
}

/**
 * Get performance metrics for a specific operation
 * @param name Name of the operation
 * @returns Array of performance metrics for the operation
 */
export function getMetricsByName(name: string): PerformanceMetric[] {
  return performanceMetrics.filter(metric => metric.name === name);
}

/**
 * Calculate average duration for a specific operation
 * @param name Name of the operation
 * @returns Average duration in milliseconds
 */
export function getAverageDuration(name: string): number {
  const metrics = getMetricsByName(name);

  if (metrics.length === 0) {
    return 0;
  }

  const totalDuration = metrics.reduce((sum, metric) => sum + metric.duration, 0);
  return totalDuration / metrics.length;
}

/**
 * Clear all recorded performance metrics
 */
export function clearMetrics(): void {
  performanceMetrics.length = 0;
}

// Cache configuration
export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    enableOfflineQueue: boolean;
  };
  memory: {
    max: number; // Maximum number of items
    ttl: number; // Time to live in milliseconds
  };
}

const cacheConfig: CacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
  },
  memory: {
    max: parseInt(process.env.MEMORY_CACHE_SIZE || '1000'),
    ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300000'), // 5 minutes
  },
};

// Redis cache service
export class RedisCacheService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis(cacheConfig.redis);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      logger.warn('Redis disconnected');
    });

    this.client.on('error', error => {
      logger.error('Redis connection error', {}, error);
    });

    this.client.on('ready', () => {
      logger.info('Redis ready for operations');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', { key }, error as Error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.error('Redis set error', { key, ttlSeconds }, error as Error);
      return false;
    }
  }

  async del(key: string | string[]): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.del(Array.isArray(key) ? key : [key]);
      return true;
    } catch (error) {
      logger.error('Redis delete error', { key }, error as Error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { key }, error as Error);
      return false;
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      logger.error('Redis delete by pattern error', { pattern }, error as Error);
      return 0;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Memory cache service using LRU
export class MemoryCacheService {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache({
      max: cacheConfig.memory.max,
      ttl: cacheConfig.memory.ttl,
    });
  }

  get<T>(key: string): T | null {
    return this.cache.get(key) || null;
  }

  set(key: string, value: any, ttlMs?: number): boolean {
    try {
      if (ttlMs) {
        this.cache.set(key, value, { ttl: ttlMs });
      } else {
        this.cache.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Memory cache set error', { key }, error as Error);
      return false;
    }
  }

  del(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Multi-level cache service
export class CacheService {
  private redis: RedisCacheService;
  private memory: MemoryCacheService;

  constructor() {
    this.redis = new RedisCacheService();
    this.memory = new MemoryCacheService();
  }

  // Get from memory first, then Redis
  async get<T>(key: string, useMemory: boolean = true): Promise<T | null> {
    // Try memory cache first
    if (useMemory) {
      const memoryValue = this.memory.get<T>(key);
      if (memoryValue !== null) {
        return memoryValue;
      }
    }

    // Try Redis cache
    const redisValue = await this.redis.get<T>(key);
    if (redisValue !== null && useMemory) {
      // Store in memory for faster access
      this.memory.set(key, redisValue);
    }

    return redisValue;
  }

  // Set in both caches
  async set(
    key: string,
    value: any,
    ttlSeconds?: number,
    useMemory: boolean = true
  ): Promise<boolean> {
    const redisResult = await this.redis.set(key, value, ttlSeconds);

    if (useMemory) {
      const memoryTtl = ttlSeconds ? ttlSeconds * 1000 : undefined;
      this.memory.set(key, value, memoryTtl);
    }

    return redisResult;
  }

  // Delete from both caches
  async del(key: string | string[]): Promise<boolean> {
    const keys = Array.isArray(key) ? key : [key];

    keys.forEach(k => this.memory.del(k));
    return await this.redis.del(key);
  }

  // Cache with function execution
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds: number = 300,
    useMemory: boolean = true
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, useMemory);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await measurePerformance(`cache_fetch:${key}`, fetchFunction);

      await this.set(key, result, ttlSeconds, useMemory);
      return result;
    } catch (error) {
      logger.error('Cache getOrSet function execution failed', { key }, error as Error);
      throw error;
    }
  }

  // Clear all caches
  async clearAll(): Promise<void> {
    this.memory.clear();
    await this.redis.deleteByPattern('*');
  }
}

// Database query optimization helpers
export class QueryOptimizer {
  // Generate cache key for database queries
  static generateQueryKey(query: string, params?: any[]): string {
    const paramString = params ? JSON.stringify(params) : '';
    const hash = require('crypto')
      .createHash('md5')
      .update(query + paramString)
      .digest('hex');
    return `query:${hash}`;
  }

  // Cache database query results
  static async cacheQuery<T>(
    cacheService: CacheService,
    query: string,
    params: any[],
    executeQuery: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cacheKey = QueryOptimizer.generateQueryKey(query, params);

    return await cacheService.getOrSet(cacheKey, executeQuery, ttlSeconds, true);
  }
}

/**
 * Create a performance report
 * @returns Performance report object
 */
export function generatePerformanceReport(): Record<string, any> {
  // Group metrics by name
  const metricsByName: Record<string, PerformanceMetric[]> = {};

  performanceMetrics.forEach(metric => {
    if (!metricsByName[metric.name]) {
      metricsByName[metric.name] = [];
    }

    metricsByName[metric.name].push(metric);
  });

  // Calculate statistics for each operation
  const report: Record<string, any> = {};

  Object.entries(metricsByName).forEach(([name, metrics]) => {
    const durations = metrics.map(m => m.duration);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const avgDuration = totalDuration / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    report[name] = {
      count: metrics.length,
      avgDuration,
      minDuration,
      maxDuration,
      totalDuration,
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
    };
  });

  return report;
}

/**
 * Calculate percentile value from an array of numbers
 * @param values Array of values
 * @param percentile Percentile to calculate (0-100)
 * @returns Percentile value
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Create singleton instances
export const cacheService = new CacheService();
