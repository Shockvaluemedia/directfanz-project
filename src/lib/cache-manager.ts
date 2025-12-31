import { getRedisClient } from './redis-production';

interface CacheConfig {
  ttl: number;
  tags?: string[];
  invalidateOn?: string[];
}

export class CacheManager {
  private redis = getRedisClient();
  private hitCount = 0;
  private missCount = 0;

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.hitCount++;
        return JSON.parse(cached);
      }
      this.missCount++;
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.missCount++;
      return null;
    }
  }

  async set(key: string, value: any, config: CacheConfig): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, config.ttl);
      
      // Store cache tags for invalidation
      if (config.tags) {
        for (const tag of config.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
          await this.redis.expire(`tag:${tag}`, config.ttl);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.redis.del(key)));
        await this.redis.del(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async warmCache(key: string, dataFn: () => Promise<any>, config: CacheConfig): Promise<void> {
    try {
      const data = await dataFn();
      await this.set(key, data, config);
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total) * 100 : 0;
  }

  getStats() {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.getHitRate(),
    };
  }

  // Predefined cache strategies
  async cacheUserData(userId: string, data: any): Promise<void> {
    await this.set(`user:${userId}`, data, {
      ttl: 900, // 15 minutes
      tags: [`user:${userId}`, 'users'],
    });
  }

  async cacheContentList(filters: any, data: any): Promise<void> {
    const key = `content:${JSON.stringify(filters)}`;
    await this.set(key, data, {
      ttl: 300, // 5 minutes
      tags: ['content', 'listings'],
    });
  }

  async cacheSubscriptionData(userId: string, data: any): Promise<void> {
    await this.set(`subscriptions:${userId}`, data, {
      ttl: 600, // 10 minutes
      tags: [`user:${userId}`, 'subscriptions'],
    });
  }
}

export const cacheManager = new CacheManager();