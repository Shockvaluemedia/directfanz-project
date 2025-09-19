import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
      },
    };

    logger.info('Database health check passed', { responseTime });

    res.status(200).json(healthCheck);
  } catch (error) {
    logger.error('Database health check failed', {}, error as Error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: (error as Error).message,
      },
    });
  }
}
