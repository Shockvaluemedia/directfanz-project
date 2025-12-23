// Cache Optimization Service for DirectFanz Platform
// Implements intelligent caching strategies and cache warming

import Redis from 'ioredis';
import * as AWS from 'aws-sdk';

interface CacheConfig {
  redisUrl: string;
  cloudfrontDistributionId?: string;
  defaultTTL: number;
  maxTTL: number;
}

interface CacheStrategy {
  key: string;
  ttl: number;
  tags: string[];
  warmOnMiss?: boolean;
}

interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  averageResponseTime: number;
}

export class CacheOptimizationService {
  private redis: Redis;
  private cloudfront: AWS.CloudFront;
  private config: CacheConfig;
  private metrics: Map<string, number>;

  constructor(config: CacheConfig) {
    this.config = config;
    this.redis = new Redis(config.redisUrl);
    this.cloudfront = new AWS.CloudFront();
    this.metrics = new Map();

    // Initialize metrics tracking
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Reset metrics every hour
    setInterval(() => {
      this.metrics.clear();
    }, 60 * 60 * 1000);
  }

  // Intelligent cache get with automatic warming
  async get<T>(key: string, strategy?: CacheStrategy): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Try to get from cache
      const cached = await this.redis.get(key);
      const responseTime = Date.now() - startTime;
      
      if (cached) {
        // Cache hit
        this.recordMetric('cache_hits', 1);
        this.recordMetric('response_time', responseTime);
        return JSON.parse(cached);
      } else {
        // Cache miss
        this.recordMetric('cache_misses', 1);
        
        // If warm on miss is enabled, trigger background warming
        if (strategy?.warmOnMiss) {
          this.warmCacheInBackground(key, strategy);
        }
        
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMetric('cache_errors', 1);
      return null;
    }
  }

  // Intelligent cache set with TTL optimization
  async set<T>(key: string, value: T, strategy?: CacheStrategy): Promise<void> {
    try {
      const ttl = this.calculateOptimalTTL(key, strategy);
      const serialized = JSON.stringify(value);
      
      // Set in Redis with TTL
      await this.redis.setex(key, ttl, serialized);
      
      // Add tags for cache invalidation
      if (strategy?.tags) {
        await this.addCacheTags(key, strategy.tags);
      }
      
      this.recordMetric('cache_sets', 1);
    } catch (error) {
      console.error('Cache set error:', error);
      this.recordMetric('cache_errors', 1);
    }
  }

  // Cache with automatic refresh
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    strategy?: CacheStrategy
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, strategy);
    
    if (cached !== null) {
      // Check if we should refresh in background
      const shouldRefresh = await this.shouldRefreshInBackground(key, strategy);
      if (shouldRefresh) {
        this.refreshCacheInBackground(key, fetcher, strategy);
      }
      return cached;
    }
    
    // Cache miss - fetch and cache
    const value = await fetcher();
    await this.set(key, value, strategy);
    return value;
  }

  // Invalidate cache by tags
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
        }
      }
      
      this.recordMetric('cache_invalidations', tags.length);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Warm cache for popular content
  async warmCache(warmingStrategies: Array<{
    key: string;
    fetcher: () => Promise<any>;
    strategy?: CacheStrategy;
  }>): Promise<void> {
    console.log(`Warming cache for ${warmingStrategies.length} items...`);
    
    const warmingPromises = warmingStrategies.map(async ({ key, fetcher, strategy }) => {
      try {
        // Check if already cached
        const exists = await this.redis.exists(key);
        if (!exists) {
          const value = await fetcher();
          await this.set(key, value, strategy);
          console.log(`Warmed cache for key: ${key}`);
        }
      } catch (error) {
        console.error(`Failed to warm cache for key ${key}:`, error);
      }
    });
    
    await Promise.allSettled(warmingPromises);
    this.recordMetric('cache_warming_operations', warmingStrategies.length);
  }

  // Get cache performance metrics
  async getMetrics(): Promise<CacheMetrics> {
    const hits = this.metrics.get('cache_hits') || 0;
    const misses = this.metrics.get('cache_misses') || 0;
    const totalRequests = hits + misses;
    const totalResponseTime = this.metrics.get('response_time') || 0;
    
    return {
      hitRate: totalRequests > 0 ? (hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (misses / totalRequests) * 100 : 0,
      totalRequests,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0
    };
  }

  // Optimize cache based on usage patterns
  async optimizeCache(): Promise<void> {
    console.log('Starting cache optimization...');
    
    try {
      // Get cache statistics
      const info = await this.redis.info('memory');
      const usedMemory = this.parseRedisInfo(info, 'used_memory');
      const maxMemory = this.parseRedisInfo(info, 'maxmemory');
      
      if (maxMemory > 0 && usedMemory / maxMemory > 0.8) {
        console.log('Cache memory usage high, cleaning up expired keys...');
        await this.cleanupExpiredKeys();
      }
      
      // Analyze key patterns and suggest optimizations
      const keyPatterns = await this.analyzeKeyPatterns();
      console.log('Cache key patterns:', keyPatterns);
      
    } catch (error) {
      console.error('Cache optimization error:', error);
    }
  }

  // CloudFront cache invalidation
  async invalidateCloudFrontCache(paths: string[]): Promise<void> {
    if (!this.config.cloudfrontDistributionId) {
      console.warn('CloudFront distribution ID not configured');
      return;
    }
    
    try {
      const params = {
        DistributionId: this.config.cloudfrontDistributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths
          },
          CallerReference: `invalidation-${Date.now()}`
        }
      };
      
      const result = await this.cloudfront.createInvalidation(params).promise();
      console.log('CloudFront invalidation created:', result.Invalidation?.Id);
      
    } catch (error) {
      console.error('CloudFront invalidation error:', error);
    }
  }

  private calculateOptimalTTL(key: string, strategy?: CacheStrategy): number {
    if (strategy?.ttl) {
      return strategy.ttl;
    }
    
    // Intelligent TTL based on key patterns
    if (key.includes('user:')) {
      return 300; // 5 minutes for user data
    } else if (key.includes('static:')) {
      return 86400; // 24 hours for static content
    } else if (key.includes('api:')) {
      return 600; // 10 minutes for API responses
    }
    
    return this.config.defaultTTL;
  }

  private async addCacheTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
    }
  }

  private async shouldRefreshInBackground(key: string, strategy?: CacheStrategy): Promise<boolean> {
    try {
      const ttl = await this.redis.ttl(key);
      const refreshThreshold = strategy?.ttl ? strategy.ttl * 0.2 : this.config.defaultTTL * 0.2;
      
      // Refresh if TTL is less than 20% of original
      return ttl > 0 && ttl < refreshThreshold;
    } catch (error) {
      return false;
    }
  }

  private async refreshCacheInBackground<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    strategy?: CacheStrategy
  ): Promise<void> {
    // Don't await - run in background
    setImmediate(async () => {
      try {
        const value = await fetcher();
        await this.set(key, value, strategy);
        console.log(`Background refresh completed for key: ${key}`);
      } catch (error) {
        console.error(`Background refresh failed for key ${key}:`, error);
      }
    });
  }

  private async warmCacheInBackground(key: string, strategy: CacheStrategy): Promise<void> {
    // This would typically trigger a background job to warm the cache
    console.log(`Triggering background cache warming for key: ${key}`);
    // Implementation would depend on your job queue system
  }

  private recordMetric(metric: string, value: number): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }

  private parseRedisInfo(info: string, key: string): number {
    const lines = info.split('\r\n');
    const line = lines.find(l => l.startsWith(`${key}:`));
    return line ? parseInt(line.split(':')[1]) : 0;
  }

  private async cleanupExpiredKeys(): Promise<void> {
    // This would implement intelligent cleanup of expired keys
    // Redis handles this automatically, but we could optimize further
    console.log('Cleaning up expired cache keys...');
  }

  private async analyzeKeyPatterns(): Promise<Record<string, number>> {
    try {
      // Sample key patterns to understand cache usage
      const patterns = ['user:*', 'api:*', 'static:*', 'session:*'];
      const analysis: Record<string, number> = {};
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        analysis[pattern] = keys.length;
      }
      
      return analysis;
    } catch (error) {
      console.error('Key pattern analysis error:', error);
      return {};
    }
  }

  // Cleanup resources
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export default CacheOptimizationService;