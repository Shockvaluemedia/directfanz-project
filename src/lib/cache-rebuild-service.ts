/**
 * Cache Rebuild Service for Redis Migration
 * Rebuilds cache data from primary sources after migration to ElastiCache
 * Implements Requirements 11.3
 */

import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getParameter, isRunningInECS } from './aws-config';
import { logger } from './logger';

interface CacheRebuildConfig {
  sourceRedisUrl?: string;
  targetRedisUrl: string;
  databaseUrl: string;
  batchSize: number;
  verifyData: boolean;
  preserveSessions: boolean;
  rebuildFromDatabase: boolean;
}

interface RebuildProgress {
  totalKeys: number;
  rebuiltKeys: number;
  failedKeys: number;
  currentKey?: string;
  errors: string[];
  startTime: Date;
  estimatedCompletion?: Date;
  categories: {
    sessions: number;
    apiCache: number;
    userCache: number;
    contentCache: number;
    streamCache: number;
    other: number;
  };
}

interface CacheKeyInfo {
  key: string;
  type: string;
  ttl: number;
  category: keyof RebuildProgress['categories'];
  size: number;
}

export class CacheRebuildService {
  private sourceRedis?: Redis;
  private targetRedis: Redis;
  private prisma: PrismaClient;
  private config: CacheRebuildConfig;
  private progress: RebuildProgress;

  constructor(config: CacheRebuildConfig) {
    this.config = config;
    
    // Initialize Redis clients
    if (config.sourceRedisUrl) {
      this.sourceRedis = new Redis(config.sourceRedisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }

    this.targetRedis = new Redis(config.targetRedisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Initialize Prisma client
    this.prisma = new PrismaClient({
      datasources: { db: { url: config.databaseUrl } },
      log: ['error', 'warn'],
    });

    // Initialize progress tracking
    this.progress = {
      totalKeys: 0,
      rebuiltKeys: 0,
      failedKeys: 0,
      errors: [],
      startTime: new Date(),
      categories: {
        sessions: 0,
        apiCache: 0,
        userCache: 0,
        contentCache: 0,
        streamCache: 0,
        other: 0,
      },
    };
  }

  /**
   * Execute complete cache rebuild process
   */
  async executeRebuild(): Promise<RebuildProgress> {
    logger.info('🚀 Starting cache rebuild process...');

    try {
      // Step 1: Connect to Redis instances
      await this.connectToRedis();

      // Step 2: Clear target cache
      await this.clearTargetCache();

      // Step 3: Analyze source cache (if available)
      if (this.sourceRedis) {
        await this.analyzeSourceCache();
      }

      // Step 4: Rebuild cache data
      if (this.config.rebuildFromDatabase) {
        await this.rebuildFromDatabase();
      } else if (this.sourceRedis) {
        await this.migrateFromSource();
      }

      // Step 5: Verify cache functionality
      if (this.config.verifyData) {
        await this.verifyCacheFunctionality();
      }

      // Step 6: Warm up critical cache entries
      await this.warmUpCache();

      logger.info('✅ Cache rebuild completed successfully');
      return this.progress;

    } catch (error) {
      logger.error('❌ Cache rebuild failed', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Connect to Redis instances
   */
  private async connectToRedis(): Promise<void> {
    logger.info('Connecting to Redis instances...');

    try {
      // Connect to target Redis
      await this.targetRedis.connect();
      const targetInfo = await this.targetRedis.info('server');
      logger.info('✅ Connected to target Redis (ElastiCache)');

      // Connect to source Redis if available
      if (this.sourceRedis) {
        await this.sourceRedis.connect();
        const sourceInfo = await this.sourceRedis.info('server');
        logger.info('✅ Connected to source Redis');
      }

      // Test basic operations
      await this.targetRedis.set('test:connection', 'ok', 'EX', 10);
      const testValue = await this.targetRedis.get('test:connection');
      if (testValue !== 'ok') {
        throw new Error('Target Redis connection test failed');
      }
      await this.targetRedis.del('test:connection');

      logger.info('✅ Redis connections verified');

    } catch (error) {
      logger.error('❌ Failed to connect to Redis', { error });
      throw error;
    }
  }

  /**
   * Clear target cache
   */
  private async clearTargetCache(): Promise<void> {
    logger.info('Clearing target cache...');

    try {
      // Get current key count
      const keyCount = await this.targetRedis.dbsize();
      
      if (keyCount > 0) {
        logger.info(`🧹 Clearing ${keyCount} existing keys from target cache`);
        await this.targetRedis.flushdb();
        logger.info('✅ Target cache cleared');
      } else {
        logger.info('✅ Target cache is already empty');
      }

    } catch (error) {
      logger.error('❌ Failed to clear target cache', { error });
      throw error;
    }
  }

  /**
   * Analyze source cache structure
   */
  private async analyzeSourceCache(): Promise<void> {
    if (!this.sourceRedis) return;

    logger.info('Analyzing source cache structure...');

    try {
      // Get all keys using SCAN to avoid blocking
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await this.sourceRedis.scan(cursor, 'COUNT', 1000);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      this.progress.totalKeys = keys.length;
      logger.info(`📊 Found ${keys.length} keys in source cache`);

      // Categorize keys
      for (const key of keys) {
        const category = this.categorizeKey(key);
        this.progress.categories[category]++;
      }

      logger.info('📈 Key categories:');
      Object.entries(this.progress.categories).forEach(([category, count]) => {
        if (count > 0) {
          logger.info(`  ${category}: ${count}`);
        }
      });

    } catch (error) {
      logger.error('❌ Failed to analyze source cache', { error });
      throw error;
    }
  }

  /**
   * Categorize cache key by pattern
   */
  private categorizeKey(key: string): keyof RebuildProgress['categories'] {
    if (key.startsWith('session:') || key.startsWith('sess:')) {
      return 'sessions';
    } else if (key.startsWith('api:') || key.startsWith('cache:api:')) {
      return 'apiCache';
    } else if (key.startsWith('user:') || key.startsWith('profile:')) {
      return 'userCache';
    } else if (key.startsWith('content:') || key.startsWith('media:')) {
      return 'contentCache';
    } else if (key.startsWith('stream:') || key.startsWith('live:')) {
      return 'streamCache';
    } else {
      return 'other';
    }
  }

  /**
   * Migrate cache data from source Redis
   */
  private async migrateFromSource(): Promise<void> {
    if (!this.sourceRedis) return;

    logger.info('Migrating cache data from source Redis...');

    try {
      // Get all keys
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await this.sourceRedis.scan(cursor, 'COUNT', 1000);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      // Process keys in batches
      const batches = this.createBatches(keys, this.config.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} keys)`);

        await this.migrateBatch(batch);

        // Update progress
        const completedKeys = this.progress.rebuiltKeys + this.progress.failedKeys;
        const progressPercent = Math.round((completedKeys / this.progress.totalKeys) * 100);
        logger.info(`📈 Progress: ${progressPercent}% (${completedKeys}/${this.progress.totalKeys})`);
      }

    } catch (error) {
      logger.error('❌ Failed to migrate from source', { error });
      throw error;
    }
  }

  /**
   * Migrate a batch of keys
   */
  private async migrateBatch(keys: string[]): Promise<void> {
    const pipeline = this.targetRedis.pipeline();

    for (const key of keys) {
      try {
        this.progress.currentKey = key;

        // Get key type and value from source
        const type = await this.sourceRedis!.type(key);
        const ttl = await this.sourceRedis!.ttl(key);

        switch (type) {
          case 'string':
            const stringValue = await this.sourceRedis!.get(key);
            if (stringValue !== null) {
              if (ttl > 0) {
                pipeline.setex(key, ttl, stringValue);
              } else {
                pipeline.set(key, stringValue);
              }
            }
            break;

          case 'hash':
            const hashValue = await this.sourceRedis!.hgetall(key);
            if (Object.keys(hashValue).length > 0) {
              pipeline.hmset(key, hashValue);
              if (ttl > 0) {
                pipeline.expire(key, ttl);
              }
            }
            break;

          case 'list':
            const listValue = await this.sourceRedis!.lrange(key, 0, -1);
            if (listValue.length > 0) {
              pipeline.rpush(key, ...listValue);
              if (ttl > 0) {
                pipeline.expire(key, ttl);
              }
            }
            break;

          case 'set':
            const setValue = await this.sourceRedis!.smembers(key);
            if (setValue.length > 0) {
              pipeline.sadd(key, ...setValue);
              if (ttl > 0) {
                pipeline.expire(key, ttl);
              }
            }
            break;

          case 'zset':
            const zsetValue = await this.sourceRedis!.zrange(key, 0, -1, 'WITHSCORES');
            if (zsetValue.length > 0) {
              const args: (string | number)[] = [key];
              for (let i = 0; i < zsetValue.length; i += 2) {
                args.push(zsetValue[i + 1], zsetValue[i]); // score, member
              }
              pipeline.zadd(...args);
              if (ttl > 0) {
                pipeline.expire(key, ttl);
              }
            }
            break;

          default:
            logger.warn(`⚠️ Unsupported key type: ${type} for key: ${key}`);
            this.progress.failedKeys++;
            continue;
        }

        this.progress.rebuiltKeys++;

      } catch (error) {
        logger.error(`❌ Failed to migrate key ${key}`, { error });
        this.progress.failedKeys++;
        this.progress.errors.push(`${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Execute pipeline
    try {
      await pipeline.exec();
    } catch (error) {
      logger.error('❌ Failed to execute migration pipeline', { error });
      throw error;
    }
  }

  /**
   * Rebuild cache from database
   */
  private async rebuildFromDatabase(): Promise<void> {
    logger.info('Rebuilding cache from database...');

    try {
      // Rebuild user cache
      await this.rebuildUserCache();

      // Rebuild content cache
      await this.rebuildContentCache();

      // Rebuild API response cache (selective)
      await this.rebuildApiCache();

      // Rebuild streaming cache
      await this.rebuildStreamingCache();

      logger.info('✅ Database cache rebuild completed');

    } catch (error) {
      logger.error('❌ Failed to rebuild from database', { error });
      throw error;
    }
  }

  /**
   * Rebuild user-related cache entries
   */
  private async rebuildUserCache(): Promise<void> {
    logger.info('Rebuilding user cache...');

    try {
      // Get active users (logged in within last 30 days)
      const activeUsers = await this.prisma.users.findMany({
        where: {
          last_login: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          profile_image: true,
          subscription_tier: true,
          created_at: true,
          last_login: true,
        },
      });

      logger.info(`📊 Caching ${activeUsers.length} active users`);

      const pipeline = this.targetRedis.pipeline();

      for (const user of activeUsers) {
        const userKey = `user:${user.id}`;
        const userProfile = {
          id: user.id,
          email: user.email,
          name: user.name || '',
          role: user.role,
          profile_image: user.profile_image || '',
          subscription_tier: user.subscription_tier || 'free',
          created_at: user.created_at.toISOString(),
          last_login: user.last_login?.toISOString() || '',
        };

        pipeline.hmset(userKey, userProfile);
        pipeline.expire(userKey, 3600); // 1 hour TTL

        this.progress.rebuiltKeys++;
        this.progress.categories.userCache++;
      }

      await pipeline.exec();
      logger.info('✅ User cache rebuilt');

    } catch (error) {
      logger.error('❌ Failed to rebuild user cache', { error });
      throw error;
    }
  }

  /**
   * Rebuild content-related cache entries
   */
  private async rebuildContentCache(): Promise<void> {
    logger.info('Rebuilding content cache...');

    try {
      // Get recent popular content
      const popularContent = await this.prisma.content.findMany({
        where: {
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: [
          { views: 'desc' },
          { likes: 'desc' },
        ],
        take: 1000,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          file_url: true,
          thumbnail_url: true,
          views: true,
          likes: true,
          artist_id: true,
          created_at: true,
        },
      });

      logger.info(`📊 Caching ${popularContent.length} popular content items`);

      const pipeline = this.targetRedis.pipeline();

      for (const content of popularContent) {
        const contentKey = `content:${content.id}`;
        const contentData = {
          id: content.id,
          title: content.title || '',
          description: content.description || '',
          type: content.type,
          file_url: content.file_url || '',
          thumbnail_url: content.thumbnail_url || '',
          views: content.views.toString(),
          likes: content.likes.toString(),
          artist_id: content.artist_id,
          created_at: content.created_at.toISOString(),
        };

        pipeline.hmset(contentKey, contentData);
        pipeline.expire(contentKey, 1800); // 30 minutes TTL

        this.progress.rebuiltKeys++;
        this.progress.categories.contentCache++;
      }

      await pipeline.exec();
      logger.info('✅ Content cache rebuilt');

    } catch (error) {
      logger.error('❌ Failed to rebuild content cache', { error });
      throw error;
    }
  }

  /**
   * Rebuild API response cache (selective)
   */
  private async rebuildApiCache(): Promise<void> {
    logger.info('Rebuilding API cache...');

    try {
      // Cache frequently accessed API responses
      const pipeline = this.targetRedis.pipeline();

      // Cache user counts by role
      const userCounts = await this.prisma.users.groupBy({
        by: ['role'],
        _count: { id: true },
      });

      for (const count of userCounts) {
        const key = `api:cache:users:count:${count.role}`;
        pipeline.setex(key, 300, count._count.id.toString()); // 5 minutes TTL
        this.progress.rebuiltKeys++;
        this.progress.categories.apiCache++;
      }

      // Cache content counts by type
      const contentCounts = await this.prisma.content.groupBy({
        by: ['type'],
        _count: { id: true },
      });

      for (const count of contentCounts) {
        const key = `api:cache:content:count:${count.type}`;
        pipeline.setex(key, 300, count._count.id.toString()); // 5 minutes TTL
        this.progress.rebuiltKeys++;
        this.progress.categories.apiCache++;
      }

      await pipeline.exec();
      logger.info('✅ API cache rebuilt');

    } catch (error) {
      logger.error('❌ Failed to rebuild API cache', { error });
      throw error;
    }
  }

  /**
   * Rebuild streaming-related cache entries
   */
  private async rebuildStreamingCache(): Promise<void> {
    logger.info('Rebuilding streaming cache...');

    try {
      // Get active live streams
      const activeStreams = await this.prisma.live_streams.findMany({
        where: {
          status: 'live',
        },
        select: {
          id: true,
          title: true,
          artist_id: true,
          viewer_count: true,
          started_at: true,
          stream_key: true,
        },
      });

      logger.info(`📊 Caching ${activeStreams.length} active streams`);

      const pipeline = this.targetRedis.pipeline();

      for (const stream of activeStreams) {
        const streamKey = `stream:${stream.id}`;
        const streamData = {
          id: stream.id,
          title: stream.title || '',
          artist_id: stream.artist_id,
          viewer_count: stream.viewer_count.toString(),
          started_at: stream.started_at?.toISOString() || '',
          status: 'live',
        };

        pipeline.hmset(streamKey, streamData);
        pipeline.expire(streamKey, 60); // 1 minute TTL for live data

        // Cache viewer count separately for quick access
        const viewerKey = `stream:viewers:${stream.id}`;
        pipeline.setex(viewerKey, 30, stream.viewer_count.toString());

        this.progress.rebuiltKeys += 2;
        this.progress.categories.streamCache += 2;
      }

      await pipeline.exec();
      logger.info('✅ Streaming cache rebuilt');

    } catch (error) {
      logger.error('❌ Failed to rebuild streaming cache', { error });
      throw error;
    }
  }

  /**
   * Verify cache functionality
   */
  private async verifyCacheFunctionality(): Promise<void> {
    logger.info('Verifying cache functionality...');

    try {
      // Test basic operations
      await this.targetRedis.set('test:verify', 'working', 'EX', 10);
      const testValue = await this.targetRedis.get('test:verify');
      if (testValue !== 'working') {
        throw new Error('Basic cache operation failed');
      }

      // Test hash operations
      await this.targetRedis.hmset('test:hash', { field1: 'value1', field2: 'value2' });
      const hashValue = await this.targetRedis.hgetall('test:hash');
      if (hashValue.field1 !== 'value1' || hashValue.field2 !== 'value2') {
        throw new Error('Hash cache operation failed');
      }

      // Test expiration
      await this.targetRedis.setex('test:expire', 1, 'expire-test');
      await new Promise(resolve => setTimeout(resolve, 1100));
      const expiredValue = await this.targetRedis.get('test:expire');
      if (expiredValue !== null) {
        throw new Error('Cache expiration not working');
      }

      // Cleanup test keys
      await this.targetRedis.del('test:verify', 'test:hash');

      // Test connection pooling and performance
      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, (_, i) => 
        this.targetRedis.set(`perf:test:${i}`, `value${i}`, 'EX', 10)
      );
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      logger.info(`⚡ Performance test: 100 operations in ${duration}ms`);

      // Cleanup performance test keys
      const deletePromises = Array.from({ length: 100 }, (_, i) => 
        this.targetRedis.del(`perf:test:${i}`)
      );
      await Promise.all(deletePromises);

      logger.info('✅ Cache functionality verified');

    } catch (error) {
      logger.error('❌ Cache functionality verification failed', { error });
      throw error;
    }
  }

  /**
   * Warm up critical cache entries
   */
  private async warmUpCache(): Promise<void> {
    logger.info('Warming up critical cache entries...');

    try {
      const pipeline = this.targetRedis.pipeline();

      // Warm up system configuration
      const systemConfig = {
        maintenance_mode: 'false',
        registration_enabled: 'true',
        max_upload_size: '100MB',
        supported_formats: 'jpg,png,gif,mp4,mov',
      };

      for (const [key, value] of Object.entries(systemConfig)) {
        pipeline.setex(`config:${key}`, 3600, value);
        this.progress.rebuiltKeys++;
      }

      // Warm up rate limiting counters (empty but structured)
      const rateLimitKeys = [
        'rate_limit:api:global',
        'rate_limit:upload:global',
        'rate_limit:stream:global',
      ];

      for (const key of rateLimitKeys) {
        pipeline.setex(key, 3600, '0');
        this.progress.rebuiltKeys++;
      }

      await pipeline.exec();
      logger.info('✅ Cache warm-up completed');

    } catch (error) {
      logger.error('❌ Cache warm-up failed', { error });
      throw error;
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get rebuild progress
   */
  getRebuildProgress(): RebuildProgress {
    return { ...this.progress };
  }

  /**
   * Cleanup connections
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.sourceRedis) {
        await this.sourceRedis.disconnect();
      }
      await this.targetRedis.disconnect();
      await this.prisma.$disconnect();
      logger.info('✅ Connections cleaned up');
    } catch (error) {
      logger.error('❌ Cleanup failed', { error });
    }
  }
}

/**
 * Create cache rebuild configuration from environment
 */
export async function createCacheRebuildConfig(): Promise<CacheRebuildConfig> {
  const sourceRedisUrl = process.env.SOURCE_REDIS_URL || process.env.REDIS_URL;
  const targetRedisUrl = await getParameter('/directfanz/redis/url', 'TARGET_REDIS_URL');
  const databaseUrl = await getParameter('/directfanz/database/url', 'DATABASE_URL');

  if (!targetRedisUrl || !databaseUrl) {
    throw new Error('Target Redis URL and Database URL are required');
  }

  return {
    sourceRedisUrl,
    targetRedisUrl,
    databaseUrl,
    batchSize: parseInt(process.env.CACHE_REBUILD_BATCH_SIZE || '100'),
    verifyData: process.env.CACHE_REBUILD_VERIFY !== 'false',
    preserveSessions: process.env.CACHE_REBUILD_PRESERVE_SESSIONS === 'true',
    rebuildFromDatabase: process.env.CACHE_REBUILD_FROM_DB !== 'false',
  };
}