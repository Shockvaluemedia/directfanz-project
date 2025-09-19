import { NextApiRequest, NextApiResponse } from 'next';
import { cacheService } from '@/lib/performance';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // Test Redis connection
    const testKey = `health_check_${Date.now()}`;
    const testValue = 'ping';

    // Test set and get operations
    await cacheService.set(testKey, testValue, 1); // 1 second TTL
    const retrievedValue = await cacheService.get(testKey);

    // Clean up
    await cacheService.del(testKey);

    const responseTime = Date.now() - startTime;

    if (retrievedValue === testValue) {
      const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: {
          connected: true,
          responseTime: `${responseTime}ms`,
          operations: 'read/write successful',
        },
      };

      logger.info('Redis health check passed', { responseTime });
      res.status(200).json(healthCheck);
    } else {
      throw new Error('Redis read/write test failed');
    }
  } catch (error) {
    logger.error('Redis health check failed', {}, error as Error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: {
        connected: false,
        error: (error as Error).message,
      },
    });
  }
}
