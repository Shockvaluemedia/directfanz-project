import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from './database-production';
import { getRedisClient } from './redis';

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
    if (this.redis) {
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
    }

    // Execute query
    const dbStart = Date.now();
    const data = await queryFn();
    dbQueryTime = Date.now() - dbStart;

    // Cache result
    if (this.redis) {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    }

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
          where: { artistId: userId },
          select: {
            id: true,
            title: true,
            createdAt: true,
            totalViews: true,
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
        return await this.db.client.subscriptions.findMany({
          where: { fanId: userId },
          include: {
            tiers: {
              select: {
                id: true,
                name: true,
                minimumPrice: true,
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