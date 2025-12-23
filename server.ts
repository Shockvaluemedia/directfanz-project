import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { parse } from 'node:url';
import { initializeSocket } from './src/lib/socket-server';
import { logger } from './src/lib/logger';
import { isRunningInECS, loadAWSConfiguration } from './src/lib/aws-config';

const dev = process.env.NODE_ENV !== 'production';
const hostname = isRunningInECS() ? '0.0.0.0' : 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Prepare Next.js app
const nextApp = next({ dev, hostname, port });
const nextHandler = nextApp.getRequestHandler();

export default async function createCustomServer() {
  // Load AWS configuration if running in production
  if (process.env.NODE_ENV === 'production' && isRunningInECS()) {
    try {
      logger.info('Loading AWS configuration from Parameter Store...');
      const config = await loadAWSConfiguration();
      
      // Set environment variables from Parameter Store
      if (config.databaseUrl) process.env.DATABASE_URL = config.databaseUrl;
      if (config.redisUrl) process.env.REDIS_URL = config.redisUrl;
      if (config.nextAuthSecret) process.env.NEXTAUTH_SECRET = config.nextAuthSecret;
      if (config.stripeSecretKey) process.env.STRIPE_SECRET_KEY = config.stripeSecretKey;
      if (config.openAiApiKey) process.env.OPENAI_API_KEY = config.openAiApiKey;
      if (config.sendGridApiKey) process.env.SENDGRID_API_KEY = config.sendGridApiKey;
      if (config.sentryDsn) process.env.SENTRY_DSN = config.sentryDsn;
      if (config.encryptionKey) process.env.ENCRYPTION_KEY = config.encryptionKey;
      if (config.jwtSecret) process.env.JWT_SECRET = config.jwtSecret;
      
      logger.info('AWS configuration loaded successfully');
    } catch (error) {
      logger.warn('Failed to load AWS configuration, using environment variables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  await nextApp.prepare();

  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await nextHandler(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO server with messaging system
  const io = initializeSocket(httpServer);

  // Global error handling for Socket.IO
  io.engine.on('connection_error', err => {
    logger.error('Socket.IO connection error', {
      req: err.req,
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  // Graceful shutdown handling for ECS
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    httpServer.close(() => {
      logger.info('HTTP server closed');
      io.close(() => {
        logger.info('Socket.IO server closed');
        process.exit(0);
      });
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return { httpServer, io, nextApp };
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createCustomServer()
    .then(({ httpServer }) => {
      httpServer.listen(port, hostname, () => {
        logger.info(`🚀 Server ready on http://${hostname}:${port}`);
        logger.info('📡 WebSocket and WebRTC signaling server active');
        
        if (isRunningInECS()) {
          logger.info('🐳 Running in AWS ECS environment');
        }
      });
    })
    .catch(err => {
      logger.error('Failed to start server', {}, err);
      process.exit(1);
    });
}
