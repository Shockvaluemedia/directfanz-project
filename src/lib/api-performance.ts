import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from './database-production';
import { getRedisClient } from './redis-production';

interface PerformanceMetrics {
  responseTime: number;
  dbQueryTime: number;
  cacheHit: boolean;
}

export class APIPerformanceOptimizer {
  private db = getDatabaseClient();
  private redis = getRedisClient();

  async optimizeQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl = 300
  ): Promise<{ data: T; metrics: PerformanceMetrics }> {
    const startTime = Date.now();
    let dbQueryTime = 0;
    let cacheHit = false;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      cacheHit = true;
      return {
        data: JSON.parse(cached),
        metrics: {
          responseTime: Date.now() - startTime,
          dbQueryTime: 0,
          cacheHit: true,
        },
      };
    }

    // Execute query
    const dbStart = Date.now();
    const data = await queryFn();
    dbQueryTime = Date.now() - dbStart;

    // Cache result
    await this.redis.set(cacheKey, JSON.stringify(data), ttl);

    return {
      data,
      metrics: {
        responseTime: Date.now() - startTime,
        dbQueryTime,
        cacheHit: false,
      },
    };
  }

  async getOptimizedUserContent(userId: string) {
    return this.optimizeQuery(
      `user:${userId}:content`,
      async () => {
        return await this.db.client.content.findMany({
          where: { authorId: userId },
          select: {
            id: true,
            title: true,
            createdAt: true,
            viewCount: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
      600 // 10 minutes cache
    );
  }

  async getOptimizedSubscriptions(userId: string) {
    return this.optimizeQuery(
      `user:${userId}:subscriptions`,
      async () => {
        return await this.db.client.subscription.findMany({
          where: { userId },
          include: {
            tier: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        });
      },
      300 // 5 minutes cache
    );
  }
}

export const apiOptimizer = new APIPerformanceOptimizer();