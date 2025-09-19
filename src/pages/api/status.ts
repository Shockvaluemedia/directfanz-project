import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = {
      service: 'Direct Fan API',
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      features: {
        authentication: 'enabled',
        payments: 'enabled',
        fileUploads: 'enabled',
        caching: process.env.REDIS_HOST ? 'enabled' : 'disabled',
        emailService:
          process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY ? 'enabled' : 'disabled',
      },
      limits: {
        maxFileSize: '50MB',
        rateLimitWindow: process.env.RATE_LIMIT_WINDOW_MS || '900000',
        rateLimitMax: process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      },
    };

    logger.info('Status check requested');

    res.status(200).json(status);
  } catch (error) {
    logger.error('Status check failed', {}, error as Error);

    res.status(500).json({
      service: 'Direct Fan API',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
}
